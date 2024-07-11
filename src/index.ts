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
import { logRequest, deriveBackboneContext, sendBackResponse, getBackBoneSetting } from "./utils";
import { TokenHandler } from './token';
import { consoleLogger, fileLogger, logErrorTransaction, logSuccessTransaction } from './logger';  
import { log } from 'console';

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
  const backboneSetting : BackboneSetting = await getBackBoneSetting();

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
    fileLogger.info(`Server is running on port 8080 with worker ${process.pid}`);
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
      logSuccessTransaction(backboneContext);
  }
  catch( error : any ) {
    fileLogger.error(`Error occurred while processing the request: ${error}`);
    let oagError = null;
    if( error instanceof OAGError ) {
      oagError = error;
    }
    else {
      oagError = new OAGError('Internal server error', 'SYS00', 500, 'Internal server error ' + error )
    }
    logErrorTransaction(backboneContext, oagError);

    let errorMsg = {
      errorCode: oagError.errorCode,
      message: oagError.message
    }
    response.setHeader('x-gtwy-errorcode', oagError.errorCode);
    response.status(oagError.httpCode).send(errorMsg);
  }
}

