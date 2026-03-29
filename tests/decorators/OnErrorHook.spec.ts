import { describe, it, expect, vi } from 'vitest';

import { OnErrorHook } from '../../src/decorators/on-error.hook';

describe('OnErrorHook', () => {
  describe('applied to a method', () => {
    it('should fire callback when sync method throws', () => {
      const testError = new Error('sync failure');
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      class TestService {
        @OnErrorHook(callback)
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][3]).toBe(testError);
    });

    it('should fire callback when async method rejects', async () => {
      const testError = new Error('async failure');
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      class TestService {
        @OnErrorHook(callback)
        async failing() {
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failing()).rejects.toThrow(testError);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][3]).toBe(testError);
    });

    it('should allow callback to provide a recovery value', () => {
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, _error: unknown) => {
          return 'recovered';
        },
      );

      class TestService {
        @OnErrorHook(callback)
        failing(): string {
          throw new Error('oops');
        }
      }

      const service = new TestService();
      const result = service.failing();

      expect(result).toBe('recovered');
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should not fire callback when method succeeds', () => {
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      class TestService {
        @OnErrorHook(callback)
        succeeding() {
          return 'success';
        }
      }

      const service = new TestService();
      const result = service.succeeding();

      expect(result).toBe('success');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass args, target, propertyKey, error, and descriptor to callback', () => {
      const testError = new Error('test');
      const callback = vi.fn(
        (
          _args: unknown[],
          _t: object,
          _k: string | symbol,
          error: unknown,
          _d: PropertyDescriptor,
        ) => {
          throw error;
        },
      );

      class TestService {
        @OnErrorHook(callback)
        failing(input: string) {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing('hello')).toThrow(testError);

      const [args, target, propertyKey, error, descriptor] = callback.mock.calls[0];
      expect(args).toEqual(['hello']);
      expect(target).toBe(service);
      expect(propertyKey).toBe('failing');
      expect(error).toBe(testError);
      expect(descriptor).toBeDefined();
      expect(typeof descriptor.value).toBe('function');
    });
  });

  describe('applied to a class', () => {
    it('should fire callback for errors from any method', () => {
      const testErrorA = new Error('error A');
      const testErrorB = new Error('error B');
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      @OnErrorHook(callback)
      class TestService {
        methodA() {
          throw testErrorA;
        }

        methodB() {
          throw testErrorB;
        }
      }

      const service = new TestService();
      expect(() => service.methodA()).toThrow(testErrorA);
      expect(() => service.methodB()).toThrow(testErrorB);

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});
