import {IBackboneHandler, ILatency} from "./baseTypes";
import {BackboneContext, LatencyRecord} from "./baseTypes";
import jwt from 'jsonwebtoken';
import { OAGError } from "./errors";
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import fs from 'fs';
import { DebugLogger } from "util";
import { fileLogger } from "./logger";

export class TokenHandler implements IBackboneHandler, ILatency {

    startTime: number;

    constructor() {
        this.startTime = Date.now();
    }

    public process(backboneContext: BackboneContext): void {

        let tokenPayload = backboneContext.tokenPayload;
        if (tokenPayload == null) {
            throw new OAGError('Invalid token', 'ATH02', 401, 'Token payload is null');
        }

        tokenPayload['iss'] = 'provider.ehealthontario.ca';
        if( backboneContext.apiSetup.signTokenRequired ) {
            
            const alg = 'RS256';
            const header = {
                alg: alg,
                type: 'JWT',
                kid: backboneContext.backboneSetting.signingKid
            }

            const now = Math.floor(Date.now() / 1000); 
            tokenPayload['nbf'] = now - 300; 
            tokenPayload['exp'] = now + 3600 + 300;     

            const lobToken = jwt.sign(tokenPayload, backboneContext.backboneSetting.privateSigningKey, {
                algorithm: alg, 
                header: header 
              });

            backboneContext.lobExtraHeaders['Authorization'] = `Bearer ${lobToken}`;
            fs.writeFileSync('token.txt', lobToken);
        }
        else {
           const lobToken = JSON.stringify( tokenPayload );
           backboneContext.lobExtraHeaders['Authorization'] = `Bearer ${lobToken}`;
        }

        this.recordLatency(backboneContext);
        fileLogger.debug('extra lob headers: ' + JSON.stringify(backboneContext.lobExtraHeaders));
    }

    public recordLatency(backboneContext: BackboneContext): void {
        let latency: number = Date.now() - this.startTime;
        let latencyRecord: LatencyRecord = new LatencyRecord(this.startTime, latency, 'OAG Token');
        backboneContext.latencyRecords.push(latencyRecord);
    }
}
