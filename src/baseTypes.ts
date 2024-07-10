import { AxiosResponse } from "axios";
import { Agent } from 'https';
import { JwtPayload } from "jsonwebtoken";


export class BackboneSetting { 
   fmblEndPoint: string = "";
   httpsAgent: Agent | null = null;
   privateSigningKey: string = "";
   signingKid: string = "";
}

export class APISetup {
   apiName: string = "";
   requiredScope   : string = "";
   requiredProfile : string = "";
   auditRequired   : boolean = false;
   ignoreAuditFailure : boolean = false;
   signTokenRequired  : boolean = false;
}

export class WrappedRequest {
    body: any;
    params: RequestParams = new RequestParams();
    stageVariables: Record<string, string> = {};
    context:Record<string,string> =  {};
}


export class RequestParams {
   
   public path: Record<string, string> =  {};

   public querystring: Record<string, string> =  {};

   public header: Record<string, string> =  {};
}


export class BackboneContext {

   startTimeStamp: number = Date.now();
   startTime: string = new Date().toLocaleDateString();
   apiSetup: APISetup ;
   backboneSetting: BackboneSetting;
   wrappedRequest: WrappedRequest ;
   latencyRecords: LatencyRecord[]; 
   lobResponse: AxiosResponse<any, any> | null = null;
   tokenPayload : JwtPayload | null = null;
   lobExtraHeaders : Record<string, string> = {};   

   constructor(apiSetup: APISetup, backboneSetting: BackboneSetting, wrappedRequest: WrappedRequest) {
      this.apiSetup = apiSetup;
      this.backboneSetting = backboneSetting;
      this.wrappedRequest = wrappedRequest;
      this.latencyRecords = [];
   }
}

export class LatencyRecord {
   public start: number;
   public latency: number;
   public actionName: string;

   constructor(start: number, latency: number, actionName: string) {
      this.start = start;
      this.latency = latency;
      this.actionName = actionName;
   }
}

export interface ILatency{
   recordLatency(backboneContext: BackboneContext): void;
}

export interface IBackboneHandler {
   process( backboneContext: BackboneContext ) : void;
}
