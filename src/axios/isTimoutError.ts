import type { AxiosError } from "./axios.stub";

export function isTimeoutError(error: AxiosError): boolean {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
}
