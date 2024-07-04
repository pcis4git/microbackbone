
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log } from './utils'


export function handleDummyBackend(request: Request, response: Response) {
 
    const respBdoy: string = '{"id":"bcb71407-0485-4dd6-bc43-79cf176bff2a","issue":[{"code":"invalid","details":{"coding":[{"code":"110","display":"The structure and/or content is not valid for the following parameter: patient.identifier http://ehealthontario.ca/fhir/NamingSystem/id-pcr-eid:18585."},{"code":"110","display":"The structure and/or content is not valid for the following parameter: patient.identifier http://ehealthontario.ca/fhir/NamingSystem/id-registration-and-claims-branch-def-source:1004063796."},{"code":"HCNSuccess","display":"Successfully Processed Consent Override HCN"}],"text":"OLIS Partially Processed Consent Override"},"extension":[{"url":"http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-source","valueString":"OLIS"}],"severity":"warning"}],"meta":{"profile":["http://ehealthontario.ca/fhir/StructureDefinition/ca-on-consent-pcoi-profile-OperationOutcome|1.0.0"]},"resourceType":"OperationOutcome"}';
    let lobTxid : string = uuidv4();


    log(`Incoming Request: ${request.method} ${request.url}`);
    log(`Headers: ${JSON.stringify(request.headers)}`);
    log(`Query: ${JSON.stringify(request.query)}`);
    log(`Body: ${JSON.stringify(request.body)}`);


    response.setHeader('lobTxid', lobTxid);
    response.setHeader('content-type', 'application/json');
    response.status(200).send(respBdoy);

}