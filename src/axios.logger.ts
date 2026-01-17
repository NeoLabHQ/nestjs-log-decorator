import { type AxiosRequestConfig, type AxiosResponse, isAxiosError } from 'axios';

export function prettifyAxiosError(error: unknown): unknown {
  if (!isAxiosError(error)) {
    return error;
  }
  return {
    name: error.name,
    error: error.message,
    code: error.code,
    config: prettifyRequest(error.config),
    response: prettifyResponse(error.response),
    stack: error.stack,
  };
}

interface RequestWithPath extends AxiosRequestConfig {
  path?: unknown;
}

function prettifyRequest(request?: AxiosRequestConfig): object | string {
  if (!request) {
    return 'Empty request';
  }
  return {
    method: request.method,
    url: request.url,
    baseURL: request.baseURL,
    path: (request as RequestWithPath).path,
    headers: request.headers,
    data: request.data as unknown,
    params: request.params as unknown,
  };
}

function prettifyResponse(response?: AxiosResponse): object | string {
  if (!response) {
    return 'Empty response';
  }
  return {
    status: response.status,
    statusText: response.statusText,
    data: response.data as unknown,
    headers: response.headers,
  };
}
