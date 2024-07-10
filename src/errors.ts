export class OAGError extends Error {

    errorCode: string;
    
    httpCode: number;

    errorDetails: string;

    constructor(message: string, errorCode: string, httpCode: number, errorDetails: string) {
        super(message); 
        this.errorCode = errorCode; 
        this.httpCode = httpCode;
        this.name = this.constructor.name; 
        this.errorDetails = errorDetails;
    }
}