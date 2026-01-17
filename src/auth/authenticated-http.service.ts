import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios';
import pRetry from 'p-retry';
import { firstValueFrom, Observable } from 'rxjs';

import { prettifyAxiosError } from './axios.logger';

export interface AuthConfig<TRequest = unknown, TResponse = unknown> {
  endpoint: string;
  requestBuilder: () => TRequest;
  responseExtractor: (data: TResponse) => { token: string; expiry: number };
  headerBuilder: (token: string) => Record<string, string>;
}

@Injectable()
/**
 * HTTP Client with built-in authentication support
 * 
 * @example @Module({
  providers: [
    {
      provide: 'CLOUDBANKIN_HTTP',
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const tenantId = configService.get('cloudbankin.tenantId', { infer: true });
        const httpService = new HttpService(
          axios.create({
            baseURL: configService.get('cloudbankin.apiUrl', { infer: true }),
            timeout: 30000,
            headers: {
              'Cloudbankin-Tenantid': tenantId,
            },
          }),
        );

        const authConfig: AuthConfig<CloudbankinAuthRequest, CloudbankinAuthResponse> = {
          endpoint: '/authentication',
          requestBuilder: () => ({
            username: configService.get('cloudbankin.username', { infer: true }),
            password: configService.get('cloudbankin.password', { infer: true }),
          }),
          responseExtractor: ({ base64EncodedAuthenticationKey }) => ({
            token: base64EncodedAuthenticationKey,
            expiry: Math.floor(Date.now() / 1000) + configService.get('cloudbankin.tokenExpirySeconds', { infer: true }),
          }),
          headerBuilder: token => ({
            Authorization: `Basic ${token}`,
          }),
        };

        return new AuthenticatedHttpService(httpService, authConfig, 'CloudbankinService');
      },
      inject: [ConfigService],
    },
    CloudbankinService,
  ],
  exports: [CloudbankinService],
})
export class CloudbankinModule {}

export class CloudbankinService {

  constructor(@Inject('CLOUDBANKIN_HTTP') private readonly authHttpClient: AuthenticatedHttpService) {}

  async getLoan(loanId: number): Promise<CloudbankinLoan> {
    const { data } = await this.authHttpClient.get<CloudbankinLoan>(`/loans/${loanId}`, {
      params: {
        associations: 'all',
        exclude: 'guarantors,futureSchedule',
      },
    });
    return data;
  }
}

@Module({
  imports: [
    // Pass options asynchronously to prevent issue when multiple tests use the same cache
    CacheModule.registerAsync({
      useFactory: () => ({
        stores: [
          new Keyv({
            store: new CacheableMemory({ ttl: 0, lruSize: 5000 }),
          }),
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: 'CREDGENICS_HTTP',
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const httpService = new HttpService(
          axios.create({
            baseURL: configService.get('credgenics.apiUrl', { infer: true }),
            timeout: 30000,
          }),
        );

        const authConfig: AuthConfig<CredgenicsAuthRequest, CredgenicsAuthResponse> = {
          endpoint: '/user/public/access-token',
          requestBuilder: () => ({
            client_id: configService.get('credgenics.clientId', { infer: true }),
            client_secret: configService.get('credgenics.clientSecret', { infer: true }),
          }),
          responseExtractor: ({ data }) => ({
            token: data.api_key,
            expiry: data.expiry,
          }),
          headerBuilder: token => ({
            authenticationtoken: token,
          }),
        };

        return new AuthenticatedHttpService(httpService, authConfig, 'CredgenicsService');
      },
      inject: [ConfigService],
    },
    CredgenicsService,
  ],
  exports: [CredgenicsService],
})
export class CredgenicsModule {}

@Injectable()
export class CredgenicsService {

  constructor(
    @Inject('CREDGENICS_HTTP') private readonly authHttpClient: AuthenticatedHttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createLoan(loanId: string, loanData: CredgenicsLoan): Promise<void> {
    await this.authHttpClient.post(`/recovery/loan/${loanId}`, loanData);
  }

 * 
 */
export class AuthenticatedHttpService<TRequest = unknown, TResponse = unknown> implements OnModuleInit {
  private readonly logger: Logger;
  private token!: string;
  private tokenExpiry!: number;
  private authenticationPromise: Promise<void> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly authConfig: AuthConfig<TRequest, TResponse>,
    serviceName: string,
  ) {
    this.logger = new Logger(`${serviceName}:HTTP`);
  }

  async onModuleInit() {
    await this.authenticate();
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();
    return this.executeRequest(() => this.httpService.get<T>(url, this.addAuthHeaders(config)));
  }

  async post<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();
    return this.executeRequest(() => this.httpService.post<T, D>(url, data, this.addAuthHeaders(config)));
  }

  async patch<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();
    return this.executeRequest(() => this.httpService.patch<T, D>(url, data, this.addAuthHeaders(config)));
  }

  async put<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();
    return this.executeRequest(() => this.httpService.put<T, D>(url, data, this.addAuthHeaders(config)));
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();
    return this.executeRequest(() => this.httpService.delete<T>(url, this.addAuthHeaders(config)));
  }

  private async executeRequest<T>(requestFactory: () => Observable<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    return this.withAuthRetry(() => this.withHttpRetry(requestFactory));
  }

  private addAuthHeaders(config?: AxiosRequestConfig): AxiosRequestConfig {
    const authHeaders = this.authConfig.headerBuilder(this.token);
    return {
      ...config,
      headers: {
        ...config?.headers,
        ...authHeaders,
      },
    };
  }

  private async authenticate() {
    // If authentication is already in progress, wait for it
    if (this.authenticationPromise) {
      return this.authenticationPromise;
    }

    // Start new authentication
    this.authenticationPromise = this.performAuthentication();

    try {
      await this.authenticationPromise;
    } finally {
      this.authenticationPromise = null;
    }
  }

  private async performAuthentication() {
    try {
      const { data } = await this.withHttpRetry(() =>
        this.httpService.post<TResponse, TRequest>(this.authConfig.endpoint, this.authConfig.requestBuilder()),
      );

      const { token, expiry } = this.authConfig.responseExtractor(data);
      this.token = token;
      this.tokenExpiry = expiry;

      this.logger.log('Authentication successful');
    } catch (error) {
      this.logger.error('Authentication failed', prettifyAxiosError(error));
      throw error;
    }
  }

  private async ensureAuthenticated() {
    const now = Math.floor(Date.now() / 1000);

    // Refresh token if it expires in less than 1 minute
    if (!this.token || now >= this.tokenExpiry - 60) {
      await this.authenticate();
    }
  }

  private async withHttpRetry<T>(fn: () => Observable<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    return pRetry(() => firstValueFrom(fn()), {
      retries: 5,
      minTimeout: 1000,
      factor: 2,
      shouldRetry: ({ error }) => this.isRetryableError(error),
      onFailedAttempt: ({ error, attemptNumber, retriesConsumed, retriesLeft }) => {
        const isRetryable = this.isRetryableError(error);
        this.logger.debug(
          `Request (${this.getFailedRequestInfo(error)}) attempt ${attemptNumber}/${retriesConsumed + retriesLeft + 1} failed (${isRetryable ? 'will retry' : 'non-retryable'})`,
          prettifyAxiosError(error),
        );
      },
    });
  }

  private async withAuthRetry<T>(fn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    try {
      return await fn();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        this.logger.debug(`Will retry (${this.getFailedRequestInfo(error)}) after re-authentication`);
        await this.authenticate();
        return await fn();
      }
      throw error;
    }
  }

  private isRetryableError(error: unknown): boolean {
    // Not an axios error - retry (network/timeout errors)
    if (!isAxiosError(error)) {
      return true;
    }

    // Network/timeout errors (no response)
    if (!error.response) {
      return true;
    }

    // 5xx server errors
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  private getFailedRequestInfo(error: unknown): string {
    if (isAxiosError(error) && error.config) {
      const { config } = error;
      const method = config.method?.toUpperCase();
      const url = config.url;
      const queryString = config.params ? '?' + new URLSearchParams(config.params as Record<string, string>).toString() : '';
      return `${method} ${url}${queryString}`;
    }
    return 'unknown';
  }
}
