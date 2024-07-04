import {IBackboneHandler, ILatency} from "./baseTypes";
import {BackboneContext, LatencyRecord} from "./baseTypes";

export class AuditHandler implements IBackboneHandler, ILatency {

    public async process(backboneContext: BackboneContext) {

    }

    public recordLatency(backboneContext: BackboneContext): void {

    }
}
