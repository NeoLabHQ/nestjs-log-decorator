import { describe, it, expect, vi } from 'vitest';

import { AfterReturnHook } from '../../src/decorators/after-return.hook';

describe('AfterReturnHook', () => {
  describe('applied to a method', () => {
    it('should fire callback after sync method returns successfully', () => {
      const callOrder: string[] = [];
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: string) => {
          callOrder.push('afterReturn');
          return result;
        },
      );

      class TestService {
        @AfterReturnHook(callback)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'afterReturn']);
    });

    it('should fire callback after async method resolves', async () => {
      const callOrder: string[] = [];
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => {
          callOrder.push('afterReturn');
          return result;
        },
      );

      class TestService {
        @AfterReturnHook(callback)
        async fetchData(id: number) {
          callOrder.push('original');
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42 });
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'afterReturn']);
    });

    it('should allow callback to transform the return value', () => {
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: string) => {
          return `${result}-transformed`;
        },
      );

      class TestService {
        @AfterReturnHook(callback)
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world-transformed');
    });

    it('should not fire callback when method throws', () => {
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );
      const testError = new Error('failure');

      class TestService {
        @AfterReturnHook(callback)
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass args, target, propertyKey, result, and descriptor to callback', () => {
      const callback = vi.fn(
        (
          _args: unknown[],
          _t: object,
          _k: string | symbol,
          result: number,
          _d: PropertyDescriptor,
        ) => result,
      );

      class TestService {
        @AfterReturnHook(callback)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      service.add(3, 7);

      expect(callback).toHaveBeenCalledOnce();

      const [args, target, propertyKey, result, descriptor] = callback.mock.calls[0];
      expect(args).toEqual([3, 7]);
      expect(target).toBe(service);
      expect(propertyKey).toBe('add');
      expect(result).toBe(10);
      expect(descriptor).toBeDefined();
      expect(typeof descriptor.value).toBe('function');
    });
  });

  describe('applied to a class', () => {
    it('should fire callback after each method returns', () => {
      const callback = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @AfterReturnHook(callback)
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
