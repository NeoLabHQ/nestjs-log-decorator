import { describe, it, expect, vi } from 'vitest';

import { Effect } from '../../src/decorators/effect.decorator';
import { SetMeta, getMeta } from '../../src/decorators/set-meta.decorator';
import type { EffectHooks } from '../../src/decorators/set-meta.decorator';

describe('Effect', () => {
  describe('applied to a method', () => {
    it('should fire hooks correctly for sync method', () => {
      const callOrder: string[] = [];

      const hooks: EffectHooks<string> = {
        onInvoke: () => callOrder.push('onInvoke'),
        onReturn: ({ result }) => {
          callOrder.push('onReturn');
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
      expect(callOrder).toEqual(['onInvoke', 'original', 'onReturn', 'finally']);
    });

    it('should fire hooks correctly for async method', async () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      class TestService {
        @Effect({ onReturn })
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42, name: 'test' });
      expect(onReturn).toHaveBeenCalledOnce();
    });

    it('should fire onError hook when method throws', () => {
      const testError = new Error('method failure');
      const onError = vi.fn(({ error }: { error: unknown }) => { throw error; });

      class TestService {
        @Effect({ onError })
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][0].error).toBe(testError);
    });
  });

  describe('applied to a class', () => {
    it('should wrap all methods and fire hooks for each', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @Effect({ onReturn })
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

      expect(onReturn).toHaveBeenCalledTimes(2);
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
        onReturn: ({ result }) => {
          callOrder.push('onReturn');
          return result;
        },
        onError: ({ error }) => {
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
      expect(callOrder).toEqual(['onInvoke', 'original', 'onReturn', 'finally']);
    });
  });

  describe('double-logging prevention: class-level + method-level Effect on same method', () => {
    it('should fire hooks exactly once when both class and method Effect are applied (method wins)', () => {
      const classOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const methodOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      @Effect({ onReturn: classOnReturn })
      class TestService {
        @Effect({ onReturn: methodOnReturn })
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
      expect(methodOnReturn).toHaveBeenCalledOnce();
      // Class-level Effect fires only for plainMethod (skips decoratedMethod due to EFFECT_APPLIED_KEY)
      expect(classOnReturn).toHaveBeenCalledOnce();
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
      const methodOnReturn = vi.fn(({ result }: { result: string }) => `${result}-method-processed`);

      @Effect({
        onReturn: ({ result }: { result: string }) => `${result}-class-processed`,
      })
      class TestService {
        @Effect({ onReturn: methodOnReturn })
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
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @Effect({ onReturn }, EXCLUSION_KEY)
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

      // onReturn fires only for 'included'
      expect(onReturn).toHaveBeenCalledOnce();
    });

    it('should mark method with exclusionKey when applied at method level', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      class TestService {
        @Effect({ onReturn }, EXCLUSION_KEY)
        myMethod() {
          return 'result';
        }
      }

      const service = new TestService();
      const result = service.myMethod();

      expect(result).toBe('result');
      expect(onReturn).toHaveBeenCalledOnce();

      // Method should be marked with the custom exclusionKey
      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;
      expect(getMeta<boolean>(EXCLUSION_KEY, descriptor)).toBe(true);
    });

    it('should prevent double-wrap when class and method use same exclusionKey', () => {
      const EXCLUSION_KEY = Symbol('customEffect');
      const classOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const methodOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      @Effect({ onReturn: classOnReturn }, EXCLUSION_KEY)
      class TestService {
        @Effect({ onReturn: methodOnReturn }, EXCLUSION_KEY)
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

      // Method-level fires for decoratedMethod
      expect(methodOnReturn).toHaveBeenCalledOnce();
      // Class-level skips decoratedMethod (same exclusionKey), fires for plainMethod
      expect(classOnReturn).toHaveBeenCalledOnce();
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
