/** 
 * Stub for axios types and utils, to avoid ading axios as a dependency 
 * 
 * Please avoid adding business logic to this file.
 * */

export interface AxiosError extends Error {
    name: string;
    message: string;
    stack?: string;
    isAxiosError: true;
    config: AxiosRequestConfig;
    response: AxiosResponse;
    code?: string;
    request?: any;
    status?: number;
}

export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    path?: string;
    headers?: unknown;
    data?: unknown;
    params?: unknown;
}

export interface AxiosResponse {
    status: number;
    statusText: string;
    data: unknown;
    headers: unknown;
}

/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 *
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
export function isAxiosError(payload: unknown): payload is AxiosError {
    return isObject(payload) && ((payload as any).isAxiosError === true);
}


/**
* Determine if a value is an Object
*
* @param {*} thing The value to test
*
* @returns {boolean} True if value is an Object, otherwise false
*/
const isObject = (thing: unknown): thing is object => thing !== null && typeof thing === 'object';
