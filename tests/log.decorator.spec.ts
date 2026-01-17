import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { expect, describe, it, vi } from 'vitest'

import { Log, NoLog } from '../src/log.decorator';
import type { Logger } from '@nestjs/common';

describe('Log Decorator', () => {
  const createMockLogger = () => ({
    log: vi.fn(),
    error: vi.fn(),
  });

  describe('synchronous methods', () => {
    it('should log method invocation with arguments when onInvoke is true', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log({ onInvoke: true })
        loadData(id: number, params: Record<string, unknown>) {
          return { id, params };
        }
      }

      const service = new TestService();
      service.loadData(1, { name: 'test' });

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'invoked',
        args: { id: 1, params: { name: 'test' } },
      });
    });

    it('should NOT log method invocation when onInvoke is not set', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        loadData(id: number, params: Record<string, unknown>) {
          return { id, params };
        }
      }

      const service = new TestService();
      service.loadData(1, { name: 'test' });

      expect(mockLogger.log).not.toHaveBeenCalledWith({
        method: 'loadData',
        state: 'invoked',
        args: { id: 1, params: { name: 'test' } },
      });
      // Should still log success
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'success',
        args: { id: 1, params: { name: 'test' } },
      });
    });

    it('should log success with returned value', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        loadData(id: number) {
          return { id, data: 'result' };
        }
      }

      const service = new TestService();
      const result = service.loadData(1);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'success',
        args: { id: 1 },
      });
      expect(result).toEqual({ id: 1, data: 'result' });
    });

    it('should log error when method throws', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        loadData(_id: number) {
          throw new Error('Test error');
        }
      }

      const service = new TestService();

      expect(() => service.loadData(1)).toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'error',
        args: { _id: 1 },
        error: expect.any(Error),
      });
    });

    it('should handle methods with no arguments', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        getData() {
          return 'data';
        }
      }

      const service = new TestService();
      service.getData();

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'getData',
        state: 'success',
        args: undefined,
      });
    });

    it('should handle methods with multiple arguments', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        processData(id: number, name: string, active: boolean) {
          return { id, name, active };
        }
      }

      const service = new TestService();
      service.processData(1, 'test', true);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'processData',
        state: 'success',
        args: { id: 1, name: 'test', active: true },
      });
    });

    it('should handle formatArgs function', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log({ args: (id: number, name: string, active: boolean) => `${id} ${name} ${active}` })
        processData(id: number, name: string, active: boolean) {
          return { id, name, active };
        }
      }

      const service = new TestService();
      service.processData(1, 'test', true);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'processData',
        state: 'success',
        args: '1 test true',
      });
    });
  });

  describe('asynchronous methods', () => {
    it('should log async method invocation with arguments when onInvoke is true', async () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log({ onInvoke: true })
        async loadData(id: number, params: Record<string, unknown>) {
          return await Promise.resolve({ id, params });
        }
      }

      const service = new TestService();
      await service.loadData(1, { name: 'test' });

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'invoked',
        args: { id: 1, params: { name: 'test' } },
      });
    });

    it('should log success for async methods', async () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        async loadData(id: number) {
          return await Promise.resolve({ id, data: 'result' });
        }
      }

      const service = new TestService();
      const result = await service.loadData(1);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'success',
        args: { id: 1 },
      });
      expect(result).toEqual({ id: 1, data: 'result' });
    });

    it('should log error when async method throws', async () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        async loadData(_id: number) {
          return await Promise.reject(new Error('Async test error'));
        }
      }

      const service = new TestService();

      await expect(service.loadData(1)).rejects.toThrow('Async test error');
      expect(mockLogger.error).toHaveBeenCalledWith({
        method: 'loadData',
        state: 'error',
        args: { _id: 1 },
        error: expect.any(Error),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined and null arguments', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        processData(value: unknown) {
          return value;
        }
      }

      const service = new TestService();

      service.processData(undefined);
      service.processData(null);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'processData',
        state: 'success',
        args: { value: undefined },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'processData',
        state: 'success',
        args: { value: null },
      });
    });

    it('should handle array arguments', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        processArray(items: number[]) {
          return items;
        }
      }

      const service = new TestService();
      service.processArray([1, 2, 3]);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'processArray',
        state: 'success',
        args: { items: [1, 2, 3] },
      });
    });

    it('should work with multiple decorated methods in same class', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        method1(id: number) {
          return id;
        }

        @Log({ onInvoke: true })
        method2(name: string) {
          return name;
        }
      }

      const service = new TestService();

      service.method1(1);
      service.method2('test');

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'invoked',
        args: { name: 'test' },
      });
    });

    it('should throw error if logger property is not found', () => {
      class TestService {
        @Log()
        loadData(id: number) {
          return id;
        }
      }

      const service = new TestService();

      expect(() => service.loadData(1)).toThrow(
        'Logger not found in TestService. Please add: readonly logger = new Logger(TestService.name)',
      );
    });

    it('should prettify axios errors when logging', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        fetchData(_url: string) {
          const error = new AxiosError('Request failed');
          error.code = 'ECONNREFUSED';
          error.config = {
            url: 'http://example.com',
            method: 'get',
          } as unknown as InternalAxiosRequestConfig;
          throw error;
        }
      }

      const service = new TestService();

      expect(() => service.fetchData('http://example.com')).toThrow();

      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall.method).toBe('fetchData');
      expect(errorCall.state).toBe('error');
      expect(errorCall.args).toEqual({ _url: 'http://example.com' });

      // Verify error is prettified
      expect(errorCall.error).toHaveProperty('name', 'AxiosError');
      expect(errorCall.error).toHaveProperty('error', 'Request failed');
      expect(errorCall.error).toHaveProperty('code', 'ECONNREFUSED');
      expect(errorCall.error).toHaveProperty('config');
      expect(errorCall.error.config).toHaveProperty('url', 'http://example.com');
    });

    it('should handle non-axios errors without prettification', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        processData(_id: number) {
          throw new Error('Regular error');
        }
      }

      const service = new TestService();

      expect(() => service.processData(1)).toThrow('Regular error');

      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall.method).toBe('processData');
      expect(errorCall.state).toBe('error');
      expect(errorCall.args).toEqual({ _id: 1 });

      // Regular errors should remain as Error instances
      expect(errorCall.error).toBeInstanceOf(Error);
      expect(errorCall.error.message).toBe('Regular error');
    });

    it('should prettify axios errors in async methods', async () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @Log()
        async fetchData(_url: string) {
          const error = new AxiosError('Async request failed');
          error.code = 'ERR_BAD_REQUEST';
          error.config = {
            url: 'http://api.example.com',
            method: 'post',
          } as unknown as InternalAxiosRequestConfig;
          return await Promise.reject(error);
        }
      }

      const service = new TestService();

      await expect(service.fetchData('http://api.example.com')).rejects.toThrow();

      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall.method).toBe('fetchData');
      expect(errorCall.state).toBe('error');

      // Verify error is prettified
      expect(errorCall.error).toHaveProperty('name', 'AxiosError');
      expect(errorCall.error).toHaveProperty('error', 'Async request failed');
      expect(errorCall.error).toHaveProperty('code', 'ERR_BAD_REQUEST');
    });
  });

  describe('class-level decorator', () => {
    it('should log all methods when applied to a class', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(id: number) {
          return { id };
        }

        method2(name: string) {
          return { name };
        }
      }

      const service = new TestService();
      service.method1(1);
      service.method2('test');

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'success',
        args: { name: 'test' },
      });
    });

    it('should log invocation for all methods when onInvoke is true at class level', () => {
      const mockLogger = createMockLogger();

      @Log({ onInvoke: true })
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(id: number) {
          return { id };
        }

        async method2(name: string) {
          return await Promise.resolve({ name });
        }
      }

      const service = new TestService();
      service.method1(1);

      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'invoked',
        args: { id: 1 },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
    });

    it('should handle errors in all methods when applied to a class', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(_id: number) {
          throw new Error('Error in method1');
        }

        method2(name: string) {
          return { name };
        }
      }

      const service = new TestService();

      expect(() => service.method1(1)).toThrow('Error in method1');
      expect(mockLogger.error).toHaveBeenCalledWith({
        method: 'method1',
        state: 'error',
        args: { _id: 1 },
        error: expect.any(Error),
      });

      service.method2('test');
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'success',
        args: { name: 'test' },
      });
    });

    it('should handle async methods when applied to a class', async () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        async method1(id: number) {
          return await Promise.resolve({ id });
        }

        async method2(_name: string) {
          return await Promise.reject(new Error('Async error'));
        }
      }

      const service = new TestService();

      await service.method1(1);
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });

      await expect(service.method2('test')).rejects.toThrow('Async error');
      expect(mockLogger.error).toHaveBeenCalledWith({
        method: 'method2',
        state: 'error',
        args: { _name: 'test' },
        error: expect.any(Error),
      });
    });

    it('should not log constructor when applied to a class', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        constructor(private readonly value: string) {
          // Constructor should not be logged
        }

        getValue() {
          return this.value;
        }
      }

      const service = new TestService('test');

      // Constructor call should not trigger any logs
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      service.getValue();
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'getValue',
        state: 'success',
        args: undefined,
      });
    });

    it('should work with mixed class-level and method-level decorators', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(id: number) {
          return { id };
        }

        @Log({ onInvoke: true })
        method2(name: string) {
          return { name };
        }
      }

      const service = new TestService();

      service.method1(1);
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
      expect(mockLogger.log).not.toHaveBeenCalledWith({
        method: 'method1',
        state: 'invoked',
        args: { id: 1 },
      });

      mockLogger.log.mockClear();

      service.method2('test');
      // method2 should have onInvoke from method-level decorator
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'invoked',
        args: { name: 'test' },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'success',
        args: { name: 'test' },
      });
    });
  });

  describe('@NoLog() decorator', () => {
    it('should skip methods marked with @NoLog() when @Log() is on class', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(id: number) {
          return { id };
        }

        @NoLog()
        method2(name: string) {
          return { name };
        }

        method3(value: string) {
          return { value };
        }
      }

      const service = new TestService();
      service.method1(1);
      service.method2('test');
      service.method3('value');

      // method1 should be logged
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });

      // method2 should NOT be logged (marked with @NoLog)
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'method2',
        }),
      );

      // method3 should be logged
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method3',
        state: 'success',
        args: { value: 'value' },
      });
    });

    it('should skip async methods marked with @NoLog()', async () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        async method1(id: number) {
          return await Promise.resolve({ id });
        }

        @NoLog()
        async method2(name: string) {
          return await Promise.resolve({ name });
        }
      }

      const service = new TestService();
      await service.method1(1);
      await service.method2('test');

      // method1 should be logged
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });

      // method2 should NOT be logged
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'method2',
        }),
      );
    });

    it('should not throw errors in @NoLog() methods even though they are not logged', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @NoLog()
        throwError() {
          throw new Error('This should not be logged');
        }
      }

      const service = new TestService();

      // Method should still throw the error
      expect(() => service.throwError()).toThrow('This should not be logged');

      // But error should NOT be logged
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should work with @NoLog() on multiple methods', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        method1(id: number) {
          return { id };
        }

        @NoLog()
        helper1() {
          return 'helper1';
        }

        @NoLog()
        helper2() {
          return 'helper2';
        }

        method2(name: string) {
          return { name };
        }
      }

      const service = new TestService();
      service.method1(1);
      service.helper1();
      service.helper2();
      service.method2('test');

      // Only method1 and method2 should be logged
      expect(mockLogger.log).toHaveBeenCalledTimes(2);
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method2',
        state: 'success',
        args: { name: 'test' },
      });
    });

    it('should have no effect when @NoLog() is used without class-level @Log()', () => {
      const mockLogger = createMockLogger();

      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @NoLog()
        method1(id: number) {
          return { id };
        }
      }

      const service = new TestService();
      service.method1(1);

      // Nothing should be logged since no @Log decorator is present
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should allow @Log() on specific method to override @NoLog()', () => {
      const mockLogger = createMockLogger();

      @Log()
      class TestService {
        readonly logger = mockLogger as unknown as Logger;

        @NoLog()
        @Log({ onInvoke: true })
        method1(id: number) {
          return { id };
        }
      }

      const service = new TestService();
      service.method1(1);

      // Method-level @Log should take precedence
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'invoked',
        args: { id: 1 },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        method: 'method1',
        state: 'success',
        args: { id: 1 },
      });
    });
  });
});
