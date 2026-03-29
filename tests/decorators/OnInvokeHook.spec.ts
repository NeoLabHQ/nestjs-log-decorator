import { describe, it, expect, vi } from 'vitest';

import { OnInvokeHook } from '../../src/decorators/on-invoke.hook';

describe('OnInvokeHook', () => {
  describe('applied to a method', () => {
    it('should fire callback before sync method executes', () => {
      const callOrder: string[] = [];
      const callback = vi.fn(() => callOrder.push('onInvoke'));

      class TestService {
        @OnInvokeHook(callback)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['onInvoke', 'original']);
    });

    it('should fire callback before async method executes', async () => {
      const callOrder: string[] = [];
      const callback = vi.fn(() => callOrder.push('onInvoke'));

      class TestService {
        @OnInvokeHook(callback)
        async fetchData(id: number) {
          callOrder.push('original');
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42 });
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['onInvoke', 'original']);
    });

    it('should pass args, target, propertyKey, and descriptor to callback', () => {
      const callback = vi.fn();

      class TestService {
        @OnInvokeHook(callback)
        doWork(a: number, b: string) {
          return `${a}-${b}`;
        }
      }

      const service = new TestService();
      service.doWork(1, 'test');

      expect(callback).toHaveBeenCalledOnce();

      const [args, target, propertyKey, descriptor] = callback.mock.calls[0];
      expect(args).toEqual([1, 'test']);
      expect(target).toBe(service);
      expect(propertyKey).toBe('doWork');
      expect(descriptor).toBeDefined();
      expect(typeof descriptor.value).toBe('function');
    });

    it('should fire callback even when method throws', () => {
      const callback = vi.fn();
      const testError = new Error('failure');

      class TestService {
        @OnInvokeHook(callback)
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('applied to a class', () => {
    it('should fire callback before each method executes', () => {
      const callback = vi.fn();

      @OnInvokeHook(callback)
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

    it('should not fire callback during construction', () => {
      const callback = vi.fn();

      @OnInvokeHook(callback)
      class TestService {
        value: number;

        constructor() {
          this.value = 42;
        }

        doWork() {
          return this.value;
        }
      }

      const service = new TestService();
      expect(service.value).toBe(42);
      expect(callback).not.toHaveBeenCalled();

      service.doWork();
      expect(callback).toHaveBeenCalledOnce();
    });
  });
});
