import log4js from 'log4js';
import dotenv from 'dotenv';
import { BackboneContext } from './baseTypes';

dotenv.config();
const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL || 'info';
const fileLogLevel    = process.env.FILE_LOG_LEVEL || 'debug';

const loggerConfig: any = {
    "appenders": {
        "console": {
            "type": "stdout",
            "layout": {
                "type": "pattern",
                "pattern": "%d{yyyy-MM-dd hh:mm:ss} [%p] %m"
            }
        },
        "rotationFile": {
            "type": "file",
            "filename": "debug.log",
            "maxLogSize": 10485760,
            "backups": 3,
            "compress": true,
            "layout": {
                "type": "pattern",
                "pattern": "%d{yyyy-MM-dd hh:mm:ss} [%p] %m"
            }
        }
    },
    "categories": {
        "default": {
            "appenders": ["console"],
            "level": consoleLogLevel
        },
        "debugCategory": {
            "appenders": ["rotationFile"],
            "level": fileLogLevel
        }
    }
};

log4js.configure(loggerConfig);
export const consoleLogger = log4js.getLogger();
export const fileLogger    = log4js.getLogger('debugCategory');


export function logSuccessTransaction(backboneContext : BackboneContext ) {
   let logEntry : any = {};
   logEntry['status'] = 'success';
   populateTxnContext( logEntry, backboneContext );

   if( backboneContext.lobResponse?.status ?? 0 >= 400 ) {
       logEntry['status'] = 'error';
       logEntry['gtwy-error-code']  = 'LOB-ERROR';
   }
   consoleLogger.info( JSON.stringify(logEntry) );
}

export function logErrorTransaction(backboneContext : BackboneContext, error : any ) {
    let logEntry : any = {};
    logEntry['status'] = 'error';
    populateTxnContext( logEntry, backboneContext );
    logEntry['gtwy-error-code']     = error['errorCode'];
    logEntry['gtwy-error-message']  = error['errorMessage'];
    consoleLogger.info( JSON.stringify(logEntry) );
}

function populateTxnContext( logEntry : any, backboneContext : BackboneContext ) {
    logEntry['apiName'] = backboneContext.apiSetup.apiName;
    logEntry['scope']   = backboneContext.apiSetup.requiredScope;
    logEntry['profile'] = backboneContext.apiSetup.requiredProfile;
    logEntry['lobUrl']  = backboneContext.wrappedRequest.stageVariables['lobEndpoint'] + backboneContext.wrappedRequest.context['resource-path'];
    logEntry['method']  = backboneContext.wrappedRequest.context['http-method'];
    logEntry['startTime'] = backboneContext.startTime;
    logEntry['endTime']   = new Date().toLocaleDateString();
    logEntry['timeToServe'] = Date.now() - backboneContext.startTimeStamp;
    logEntry['latencyRecords'] = backboneContext.latencyRecords;
}