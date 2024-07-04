import cluster, { Worker } from 'cluster';
import os from 'os';
import dotenv from 'dotenv';
import express from 'express';
import { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { WrappedRequest, RequestParams, BackboneSetting, BackboneContext, APISetup } from './baseTypes';
import { handleDummyBackend } from './dummy';
import { LobHandler } from './lob';
import { OAGError } from './errors';
import { Validator } from './validater';
import { AuditHandler } from './audit';
import { log, logRequest, deriveBackboneContext, sendBackResponse, getBackBoneSetting, getBackBoneSetting2 } from "./utils";
import { TokenHandler } from './token';

//Always load environment variables from .env file at very beginning !
dotenv.config();


// if (cluster.isPrimary) {
//   // Step 2: In the master process, fork worker processes for each CPU core
//   const numCPUs = os.cpus().length;
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on('exit', (worker : Worker) => {
//     log(`Worker ${worker.process.pid} died`);
//     cluster.fork();
//   });
// } 
// else { 

//--------------------------------------------------------------------------------------------
  // const app = express();
  // const backboneSetting : BackboneSetting = getBackBoneSetting();

  // app.use(cors());
  // app.use(bodyParser.json());
  // app.post('/backbone', (request: Request, response: Response ) => {
  //   handleRequest(request, response, backboneSetting);
  // });
  
  // // Wildcard route to handle any other path with default logic
  // app.all('*', (request: Request, response: Response) => {
  //    handleDummyBackend(request, response);
  // });

  // app.listen(8080, () => {
  //   log(`Server is running on port 8080 with worker ${process.pid}`);
  // });
//--------------------------------------------------------------------------------------------

launchExpress();

//}


async function launchExpress() {

  const app = express();
  //const backboneSetting : BackboneSetting = getBackBoneSetting();
  const backboneSetting : BackboneSetting = await getBackBoneSetting2();

  app.use(cors());
  app.use(bodyParser.json());
  app.post('/backbone', (request: Request, response: Response ) => {
    handleRequest(request, response, backboneSetting);
  });
  
  // Wildcard route to handle any other path with default logic
  app.all('*', (request: Request, response: Response) => {
     handleDummyBackend(request, response);
  });

  app.listen(8080, () => {
    log(`Server is running on port 8080 with worker ${process.pid}`);
  });

}


async function handleRequest(request: Request, response: Response, backboneSetting: BackboneSetting ) {

  const backboneContext: BackboneContext = deriveBackboneContext(request, backboneSetting);
  
  logRequest(request);

  try {
      
      new Validator().process(backboneContext);

      const tokenHandler = new TokenHandler();
      tokenHandler.process(backboneContext);

      const lobHandler = new LobHandler();
      await lobHandler.process(backboneContext);

      const auditHandler = new AuditHandler();
      await auditHandler.process(backboneContext);
      
      sendBackResponse(response, backboneContext);      
  }
  catch(error) {
    log(`Error occurred while processing the request: ${error}`);
    if( error instanceof OAGError ) {
      let errorMsg = {
        errorCode: error.errorCode,
        message: error.message
      }
      response.status(error.httpCode).send(errorMsg);
    }
    else {
      let errorMsg = {
        errorCode: 'SYS00',
        message: 'Internal server error'
      }
      response.status(500).send(errorMsg);      
    }
  }

  log(JSON.stringify(backboneContext.latencyRecords));
}

