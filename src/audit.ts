import {IBackboneHandler, ILatency} from "./baseTypes";
import {BackboneContext, LatencyRecord, WrappedRequest} from "./baseTypes";
import axios from "axios";
import { Agent } from 'https';
import { fileLogger } from "./logger";
import { OAGError } from "./errors";

export class AuditHandler implements IBackboneHandler, ILatency {

    startTime: number;
    tryTimes : number = 2;
    throwAuditError : boolean = true;

    constructor() {
      this.startTime = Date.now();
    }

    public async process(backboneContext: BackboneContext) {

        //build FMBL message
        const fmblMsg = this.buildFMBLMessage(backboneContext);


        let headers: Record<string, string> = {};
        headers["Content-Type"] = "application/json";
        headers["Authorization"] = "Bearer " + 'QlQtzuIpXDL6VnIj2MNGxcMw1VAygrvYgHSp4HTIKyxZ';
        
        var auditFailed : boolean = false; 
        const axiosConfig = {
            // validateStatus: function (status: any) {
            //   return true; 
            // },
            headers,
            httpsAgent: backboneContext.backboneSetting.httpsAgent 
        };
        
        let auditFailure : any = null;
        while (this.tryTimes > 0) {
            try {
                let response = await axios.post(backboneContext.backboneSetting.fmblEndPoint, fmblMsg, axiosConfig);
                this.tryTimes = 0;
            } 
            catch (error : any) {
                fileLogger.error(`Error in AuditHandler: ${error}`);
                backboneContext.issues.push('Error in Auditting: ' + error['message']);
                this.tryTimes--;
                if (this.tryTimes == 0) {
                    auditFailed = true; 
                }
                auditFailure = error;
            }
        }

        if ( auditFailed && this.throwAuditError) {
            throw new OAGError("Internal Server Error", "GTWY-SYS09", 500, auditFailure['message'] + '. Stack: ' + auditFailure['stack']);
        }
    }

    public recordLatency(backboneContext: BackboneContext): void {
        let latency: number = Date.now() - this.startTime;
        let latencyRecord: LatencyRecord = new LatencyRecord(this.startTime, latency, 'Audit');
        backboneContext.latencyRecords.push(latencyRecord);
    }


    private buildFMBLMessage(backboneContext: BackboneContext) {   
        const requestRecord = this.buildRequestRecord(backboneContext);        
        const responseRecord = this.buildResponseRecord(backboneContext, requestRecord);
        const fmblMsg = {"records": [ 
            { "value": requestRecord },
            { "value": responseRecord}
         ] };
         return fmblMsg;
    }

    private buildRequestRecord(backboneContext: BackboneContext) {

        const reqHeaders : any = this.getNormalizedReqHeaders(backboneContext);
        const wrappedRequest : WrappedRequest = backboneContext.wrappedRequest;

        let req : any = {};
        req['api_endpoint_url'] = 'https://' + reqHeaders['host'] + wrappedRequest.context['resource-path'];
        req['api_name'] = backboneContext.apiSetup.apiName;
        req['api_version'] = 'n/a';
        req['client_ip'] = wrappedRequest.context['source-ip'];
        req['direction'] = 'Request';
        req['gtwy_node'] = 'n/a';
        req['http_method'] = wrappedRequest.context['http-method'].toUpperCase();
        req['lob_endpoint_url'] = wrappedRequest.stageVariables['lob-endpoint'];

        //process message content of payload and querystring
        let message_content : any = {};
        let queryString = req['api_endpoint_url'] ; 
        if( wrappedRequest.context['composed-query-string'] ) {
            queryString = queryString + '?' + wrappedRequest.context['composed-query-string'];
        }
        queryString = Buffer.from(queryString).toString('base64');
        message_content['querystring'] = queryString;

        if( req['http_method'] === 'POST' || req['http_method'] === 'PUT' ) {
            let payload = Buffer.from(JSON.stringify(wrappedRequest.body)).toString('base64');
            message_content['payload'] = payload;
            req['payload_content_type'] = 'Base64/json';
        }
        req['message_content'] = message_content;

        //process request headers
        let requestHeader : any = {};
        Object.keys( wrappedRequest.params.header ).forEach((key) => {
            requestHeader[key] = wrappedRequest.params.header[key];
        });
        req['request.headers'] = requestHeader;

        return req;
    }

    private buildResponseRecord(backboneContext: BackboneContext, reqRecord : any ) {
        //use request record as base since a lot fields are the same
        let resp = Object.assign({}, reqRecord);

        //update fields that are different for request
        resp['direction'] = 'Response';

        //delete fields that are different from request
        delete resp['request.headers'];
        delete resp['message_content'];

        //if lobResponse is available, update response fields for status code and payload
        if( backboneContext.lobResponse ) {
            resp['response_code'] = backboneContext.lobResponse.status;
            resp['response_phrase'] = backboneContext.lobResponse.statusText;
            resp['response.headers'] = backboneContext.lobResponse.headers;

            if( backboneContext.lobResponse.data ) {
                let message_content : any = {};
                message_content['payload'] = Buffer.from(JSON.stringify(backboneContext.lobResponse.data)).toString('base64');
                message_content['payload_content_type'] = 'Base64/' + backboneContext.lobResponse.headers['content-type'];
                resp['message_content'] = message_content;
            }
        }
        return resp;
    }

    private getNormalizedReqHeaders(backboneContext: BackboneContext) : any {
       
       let reqHeaders: any = {};
       Object.keys(backboneContext.wrappedRequest.params.header).forEach((key) => {
           const value = backboneContext.wrappedRequest.params.header[key];
           const headerName = key.toLowerCase();
           reqHeaders[headerName] = value; 
       });

       return reqHeaders;
    }

}
