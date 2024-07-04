import {IBackboneHandler, ILatency} from "./baseTypes";
import {BackboneContext, LatencyRecord} from "./baseTypes";
import jwt  from 'jsonwebtoken';
import { JwtPayload } from "jsonwebtoken";
import { OAGError } from "./errors";


export class Validator implements IBackboneHandler, ILatency {

    startTime: number;

    constructor() {
        this.startTime = Date.now();
    }

    public process(backboneContext: BackboneContext): void {

        let headerParams: Record<string, string> = backboneContext.wrappedRequest.params.header;
        let token: string = '';
        Object.entries(headerParams).forEach(([key, value]) => {
           if( 'authorization' == key.toLowerCase() ) {
               token = value;
           }
        });

        try {
            token = token.substring(7);
            const decodedToken : JwtPayload | null = jwt.decode(token, {json: true});
            if( decodedToken == null ) {
                throw new OAGError('Invalid token', 'ATH02', 401);
            }    
            backboneContext.tokenPayload = decodedToken;
            
            const requiredScope: string = backboneContext.apiSetup.requiredScope;
            const claimedScope: any = decodedToken.scope;
            this.validateClaim(requiredScope, claimedScope, 'Invalid scope, expect ' + requiredScope + ', actual value: ' + claimedScope);
        }
        catch( error ) {

            this.recordLatency(backboneContext);

            if( error instanceof OAGError ) {
                throw error;
            }
            else {
                throw new OAGError('Invalid token', 'ATH01', 401);
            }
        }

        this.recordLatency(backboneContext);
    }

    public recordLatency(backboneContext: BackboneContext): void {
        let latency: number = Date.now() - this.startTime;
        let latencyRecord: LatencyRecord = new LatencyRecord(this.startTime, latency, 'Validator');
        backboneContext.latencyRecords.push(latencyRecord);
    }

    validateClaim(expected: String, claim: any, message: string ) {

        let isValidClaim : boolean = false;
        if( typeof claim == 'string' ) {
           isValidClaim = ( expected == claim );
        }
        else if ( Array.isArray(claim) ) {
           isValidClaim = ( claim.includes(expected) );
        }

        if( !isValidClaim ) {
            throw new OAGError(message, 'ATH03', 401);
        } 
    }


}