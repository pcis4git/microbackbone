import fs from 'fs';
import dotenv from 'dotenv';
import forge from 'node-forge';

import { Agent } from 'https';
import { BackboneContext,  APISetup, BackboneSetting, WrappedRequest  } from './baseTypes';
import { OAGError } from './errors';
import { Request, Response } from 'express';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { get } from 'http';
import { fileLogger } from './logger';


export function getHttpsAgent(): Agent {

    dotenv.config();

    const keystorePath   = process.env.KEYSTORE_PATH || '';
    const truststorePath = process.env.TRUSTSTORE_PATH || '';
    const keystorePassphrase   = process.env.KEYSTORE_PASSPHRASE || '';
    const truststorePassphrase = process.env.TRUSTSTORE_PASSPHRASE || '';
    const validateServerCert : boolean = ( 'true' == ( process.env.VALIDATE_SERVER_CERT || '') );

    // Load and configure the keystore, the buffer type is required and accepted for the pfx option
    const keystorePfx = fs.readFileSync( keystorePath );

    // load truststore as pkcs12 object
    const truststorePfx = fs.readFileSync(truststorePath);
    const truststore = forge.pkcs12.pkcs12FromAsn1(
        forge.asn1.fromDer(truststorePfx.toString('binary')),
        truststorePassphrase
    );

    // Extract CA certificates from truststore and convert them to PEM format 
    // then add them to the string array as ca option of SecureContextOptions
    let caCerts: string[] = [];
    truststore.safeContents.forEach(safeContent => {
        safeContent.safeBags.forEach( safeBag => {
            if ( safeBag.cert ) {
                const pem = forge.pki.certificateToPem(safeBag.cert);
                caCerts.push(pem);
            }
        });
    });

    // Create an agent with the keystore and the extracted CA certificates, the keystore passphrase is required
    // also the rejectUnauthorized option is set to false to ignore the certificate validation
    const agent = new Agent({
        rejectUnauthorized: validateServerCert,
        pfx: keystorePfx,
        passphrase: keystorePassphrase,
        ca: caCerts, // Use the manually extracted CA certificates from truststore
      });


    return agent;
}


export function getSigningKey(): string {

    dotenv.config();

    const keystorePath   = process.env.KEYSTORE_PATH || '';
    const keystorePassphrase   = process.env.KEYSTORE_PASSPHRASE || '';

    const keystorePfx = fs.readFileSync(keystorePath);

    // Parse the PFX to get the private key
    const keystore = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(keystorePfx.toString('binary')),
      keystorePassphrase
    );

    // Extract the private key from the keystore, encode it to PEM format
    let privateKey : string = '';
    keystore.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {     
          let keyObj = safeBag.key as forge.pki.PrivateKey;
          privateKey = forge.pki.privateKeyToPem( keyObj);
        }
      });
    });

    if( privateKey == '' ) {
        throw new Error('Private key not found in the keystore');
    }

    return privateKey; 
}

export function logRequest(request:Request) {
  fileLogger.debug(`Incoming Request: ${request.method} ${request.url}`);
  fileLogger.debug(`Headers: ${JSON.stringify(request.headers)}`);
  fileLogger.debug(`Query: ${JSON.stringify(request.query)}`);
  fileLogger.debug(`Body: ${JSON.stringify(request.body)}`);  
}

// export function getBackBoneSetting(): BackboneSetting {
//   let backboneSetting: BackboneSetting = new BackboneSetting();
//   backboneSetting.fmblEndPoint = process.env.FMBL_ENDPOINT || '';
//   backboneSetting.httpsAgent = getHttpsAgent();
//   backboneSetting.privateSigningKey = getSigningKey();
//   return backboneSetting;
// }

export function deriveBackboneContext(request: Request, backboneSetting: BackboneSetting): BackboneContext {

  let apiSetup : APISetup = new APISetup();
  apiSetup.apiName = request.header('x-oag-apiname') || "";
  apiSetup.requiredScope      = request.header('x-oag-scope') || "";
  apiSetup.requiredProfile    = request.header('x-oag-profile') || "";
  apiSetup.auditRequired      = request.header('x-oag-audit-enabled') === 'true' ? true : false;
  apiSetup.ignoreAuditFailure = request.header('x-oag-audit-ignore-failure') === 'true' ? true : false;
  apiSetup.signTokenRequired  = request.header('x-oag-sign-token-enabled') === 'true' ? true : false;
  
  let wrappedRequest: WrappedRequest = request.body;
  let backboneContext: BackboneContext = new BackboneContext(apiSetup, backboneSetting, wrappedRequest);

  return backboneContext
}

export function sendBackResponse(response: Response, backboneContext: BackboneContext) {

  const lobResponse = backboneContext.lobResponse;
  if( lobResponse == undefined || lobResponse == null ) {
     throw new OAGError('Invalid lob resposne', 'SYS01', 500, "unsuccessful LOB connection");
  }

  let statusCode = lobResponse.status;
  let responseHeaders = lobResponse.headers;
  let responseBody = lobResponse.data;

  Object.keys(responseHeaders).forEach((key) => {
     response.setHeader(key, responseHeaders[key]);
  });
  response.setHeader('x-global-transaction-id', backboneContext.globalTransactionId); 

  if( statusCode >= 400 ) {
    response.setHeader('x-gtwy-errorcode', 'LOB01');
  }


  response.status(statusCode).send(responseBody);
}

export async function getBackBoneSetting(): Promise<BackboneSetting> {
  let backboneSetting: BackboneSetting = new BackboneSetting();
  backboneSetting.fmblEndPoint = process.env.FMBL_ENDPOINT || '';

  fileLogger.info('Getting JWKS from AWS Secrets Manager...');

  const jwksValue = await getAWSSecret();
  const latestJWK = findLatestJWK(jwksValue);
  
  const publicKeyJWK  = latestJWK['public'];
  const privateKeyJWK = latestJWK['private'];
  backboneSetting.privateSigningKey = privateKeyJWK['pkcs8'];
  backboneSetting.signingKid = privateKeyJWK['kid'];

  fileLogger.info(`private key:\n ${privateKeyJWK['pkcs8']}`);
  fileLogger.info(`certificate:\n ${privateKeyJWK['cert']}`);
  fs.writeFileSync('private_key.pem', privateKeyJWK['pkcs8']);
  fs.writeFileSync('certificate.pem', privateKeyJWK['cert']);  

  // load truststore as pkcs12 object
  const truststorePath = process.env.TRUSTSTORE_PATH || '';
  const truststorePassphrase = process.env.TRUSTSTORE_PASSPHRASE || '';
  const truststorePfx = fs.readFileSync(truststorePath);
  const truststore = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(truststorePfx.toString('binary')),
      truststorePassphrase
  );

  // Extract CA certificates from truststore and convert them to PEM format 
  // then add them to the string array as ca option of SecureContextOptions
  let caCerts: string[] = [];
  truststore.safeContents.forEach(safeContent => {
      safeContent.safeBags.forEach( safeBag => {
          if ( safeBag.cert ) {
              const pem = forge.pki.certificateToPem(safeBag.cert);
              caCerts.push(pem);
          }
      });
  });

  const validateServerCert : boolean = ( 'true' == ( process.env.VALIDATE_SERVER_CERT || '') );
  const agent = new Agent({
    rejectUnauthorized: validateServerCert,
    ca: caCerts, // Use the manually extracted CA certificates from truststore
  });
  backboneSetting.httpsAgent = agent;

  return backboneSetting;
}


async function getAWSSecret(): Promise<string> {
  dotenv.config();
  const client = new SecretsManagerClient({ region: process.env.APP_REGION });

  const input = {
    SecretId: process.env.JWKS_K_NAME,
    VersionStage: "AWSCURRENT", 
  };  
  const command = new GetSecretValueCommand( input );
  const response = await client.send(command);
  return response.SecretString || '';
}

function findLatestJWK( jwksContent : string ) : any {
  
  const secretObject = JSON.parse(jwksContent);

  let sorting: { [key: string]: any } = {};
  let kids : string[] = [];

  secretObject.keys.forEach((keyEntry : any ) => {        
     let kid : string = keyEntry.kid;
     var jwkType = 'public';
     if( 'd' in keyEntry ) {
        jwkType = 'private';  
     }

     if( kid in sorting ) {       
        const item = sorting[kid];
        item[jwkType] = keyEntry;
     }
     else {
        const item : { [key: string]: any } = {};
        item[jwkType] = keyEntry;

        sorting[kid] = item;
        kids.push(kid); 
     }        
  });

  kids.sort();
  let latestKid : string = kids[kids.length - 1];
  let latestJWK = sorting[latestKid];
  return latestJWK;  
}