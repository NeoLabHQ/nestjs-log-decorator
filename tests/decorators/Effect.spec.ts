import { describe, it, expect, vi } from 'vitest';

import { Effect } from '../../src/decorators/effect.decorator';
import { SetMeta } from '../../src/decorators/set-meta.decorator';
import type { EffectHooks } from '../../src/decorators/set-meta.decorator';

describe('Effect', () => {
  describe('applied to a method', () => {
    it('should fire hooks correctly for sync method', () => {
      const callOrder: string[] = [];

      const hooks: EffectHooks<string> = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _t, _k, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        finally: () => callOrder.push('finally'),
      };

      class TestService {
        @Effect(hooks)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callOrder).toEqual(['onInvoke', 'original', 'afterReturn', 'finally']);
    });

    it('should fire hooks correctly for async method', async () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      class TestService {
        @Effect({ afterReturn })
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42, name: 'test' });
      expect(afterReturn).toHaveBeenCalledOnce();
    });

    it('should fire onError hook when method throws', () => {
      const testError = new Error('method failure');
      const onError = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      class TestService {
        @Effect({ onError })
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][3]).toBe(testError);
    });
  });

  describe('applied to a class', () => {
    it('should wrap all methods and fire hooks for each', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @Effect({ afterReturn })
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          return 'b';
        }
      }

      const service = new TestService();
      expect(service.methodA()).toBe('a');
      expect(service.methodB()).toBe('b');

      expect(afterReturn).toHaveBeenCalledTimes(2);
    });

    it('should not wrap the constructor', () => {
      const onInvoke = vi.fn();

      @Effect({ onInvoke })
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

      // onInvoke should not have been called during construction
      expect(onInvoke).not.toHaveBeenCalled();

      service.doWork();
      expect(onInvoke).toHaveBeenCalledOnce();
    });

    it('should fire all lifecycle hooks in correct order for class methods', () => {
      const callOrder: string[] = [];

      const hooks: EffectHooks<string> = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _t, _k, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        onError: (_args, _t, _k, error) => {
          callOrder.push('onError');
          throw error;
        },
        finally: () => callOrder.push('finally'),
      };

      @Effect(hooks)
      class TestService {
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callOrder).toEqual(['onInvoke', 'original', 'afterReturn', 'finally']);
    });
  });

  describe('double-logging prevention: class-level + method-level Effect on same method', () => {
    it('should fire hooks exactly once when both class and method Effect are applied (method wins)', () => {
      const classAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );
      const methodAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @Effect({ afterReturn: classAfterReturn })
      class TestService {
        @Effect({ afterReturn: methodAfterReturn })
        decoratedMethod() {
          return 'result';
        }

        plainMethod() {
          return 'plain';
        }
      }

      const service = new TestService();
      service.decoratedMethod();
      service.plainMethod();

      // Method-level Effect fires for decoratedMethod
      expect(methodAfterReturn).toHaveBeenCalledOnce();
      // Class-level Effect fires only for plainMethod (skips decoratedMethod due to EFFECT_APPLIED_KEY)
      expect(classAfterReturn).toHaveBeenCalledOnce();
    });

    it('should fire method-level hooks only once for async methods with both decorators', async () => {
      const classOnInvoke = vi.fn();
      const methodOnInvoke = vi.fn();

      @Effect({ onInvoke: classOnInvoke })
      class TestService {
        @Effect({ onInvoke: methodOnInvoke })
        async fetchData(id: number) {
          return { id };
        }

        async otherMethod() {
          return 'other';
        }
      }

      const service = new TestService();
      await service.fetchData(1);
      await service.otherMethod();

      // Method-level fires for fetchData
      expect(methodOnInvoke).toHaveBeenCalledOnce();
      // Class-level fires only for otherMethod
      expect(classOnInvoke).toHaveBeenCalledOnce();
    });

    it('should produce correct results when method-level Effect wins', () => {
      const methodAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: string) => {
          return `${result}-method-processed`;
        },
      );

      @Effect({
        afterReturn: (_args, _t, _k, result) => {
          return `${result}-class-processed`;
        },
      })
      class TestService {
        @Effect({ afterReturn: methodAfterReturn })
        targeted() {
          return 'base';
        }

        untargeted() {
          return 'base';
        }
      }

      const service = new TestService();

      // Method-level decorator processes targeted; class-level is skipped
      expect(service.targeted()).toBe('base-method-processed');
      // Class-level decorator processes untargeted
      expect(service.untargeted()).toBe('base-class-processed');
    });
  });

  describe('exclusionKey support', () => {
    it('should skip methods marked with exclusionKey when applied to a class', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @Effect({ afterReturn }, EXCLUSION_KEY)
      class TestService {
        @SetMeta(EXCLUSION_KEY, true)
        excluded() {
          return 'excluded';
        }

        included() {
          return 'included';
        }
      }

      const service = new TestService();
      service.excluded();
      service.included();

      // afterReturn fires only for 'included'
      expect(afterReturn).toHaveBeenCalledOnce();
    });

    it('should ignore exclusionKey when applied to a method (method-level has no exclusion)', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      // When Effect is used as a method decorator, exclusionKey is irrelevant
      class TestService {
        @Effect({ afterReturn }, EXCLUSION_KEY)
        myMethod() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = service.myMethod();

      expect(result).toBe('result');
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('unsupported context throws error', () => {
    it('should throw Error when applied in an unsupported context', () => {
      const decorator = Effect({});

      // Simulate an unsupported invocation: propertyKey present but descriptor is undefined
      // This cannot happen with normal TypeScript decorator application but tests the guard
      expect(() => {
        (decorator as Function)({}, 'someProperty', undefined);
      }).toThrow('Effect decorator can only be applied to classes or methods');
    });
  });
});
