export class OAGError extends Error {

    errorCode: string;
    
    httpCode: number

    constructor(message: string, errorCode: string, httpCode: number) {
        super(message); 
        this.errorCode = errorCode; 
        this.httpCode = httpCode;
        this.name = this.constructor.name; 

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}