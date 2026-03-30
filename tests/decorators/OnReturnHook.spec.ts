import { describe, it, expect, vi } from 'vitest';

import { OnReturnHook } from '../../src/decorators/on-return.hook';

describe('OnReturnHook', () => {
  describe('applied to a method', () => {
    it('should fire callback after sync method returns successfully', () => {
      const callOrder: string[] = [];
      const callback = vi.fn(({ result }: { result: string }) => {
        callOrder.push('onReturn');
        return result;
      });

      class TestService {
        @OnReturnHook(callback)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'onReturn']);
    });

    it('should fire callback after async method resolves', async () => {
      const callOrder: string[] = [];
      const callback = vi.fn(({ result }: { result: unknown }) => {
        callOrder.push('onReturn');
        return result;
      });

      class TestService {
        @OnReturnHook(callback)
        async fetchData(id: number) {
          callOrder.push('original');
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42 });
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'onReturn']);
    });

    it('should allow callback to transform the return value', () => {
      const callback = vi.fn(({ result }: { result: string }) => `${result}-transformed`);

      class TestService {
        @OnReturnHook(callback)
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world-transformed');
    });

    it('should not fire callback when method throws', () => {
      const callback = vi.fn(({ result }: { result: unknown }) => result);
      const testError = new Error('failure');

      class TestService {
        @OnReturnHook(callback)
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass args, target, propertyKey, result, and descriptor to callback', () => {
      const callback = vi.fn(({ result }: { result: number }) => result);

      class TestService {
        @OnReturnHook(callback)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      service.add(3, 7);

      expect(callback).toHaveBeenCalledOnce();

      const [context] = callback.mock.calls[0];
      expect(context.args).toEqual({ a: 3, b: 7 });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('add');
      expect(context.result).toBe(10);
      expect(context.descriptor).toBeDefined();
      expect(typeof context.descriptor.value).toBe('function');
    });
  });

  describe('applied to a class', () => {
    it('should fire callback after each method returns', () => {
      const callback = vi.fn(({ result }: { result: unknown }) => result);

      @OnReturnHook(callback)
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          return 'b';
        }
      }

      const service = new TestService();
      service.methodA();
      service.methodB();

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});
