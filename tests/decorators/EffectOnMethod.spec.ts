import { describe, it, expect, vi } from 'vitest';

import {
  EffectOnMethod,
  EFFECT_APPLIED_KEY,
} from '../../src/decorators/effect-on-method';
import { setMeta, getMeta, SetMeta } from '../../src/decorators/set-meta.decorator';
import type { EffectHooks } from '../../src/decorators/set-meta.decorator';

describe('EffectOnMethod', () => {
  describe('sync method with all 4 hooks fires in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onReturn, finally', () => {
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

      class TestService {
        @EffectOnMethod(hooks)
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

  describe('sync method error path fires hooks in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onError, finally', () => {
      const callOrder: string[] = [];
      const testError = new Error('sync failure');

      const hooks: EffectHooks = {
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

      class TestService {
        @EffectOnMethod(hooks)
        failingMethod() {
          callOrder.push('original');
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failingMethod()).toThrow(testError);
      expect(callOrder).toEqual(['onInvoke', 'original', 'onError', 'finally']);
    });
  });

  describe('async method with all 4 hooks fires in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onReturn, finally', async () => {
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

      class TestService {
        @EffectOnMethod(hooks)
        async greetAsync(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = await service.greetAsync('world');

      expect(result).toBe('hello world');
      expect(callOrder).toEqual(['onInvoke', 'original', 'onReturn', 'finally']);
    });
  });

  describe('async method error path fires hooks in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onError, finally', async () => {
      const callOrder: string[] = [];
      const testError = new Error('async failure');

      const hooks: EffectHooks = {
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

      class TestService {
        @EffectOnMethod(hooks)
        async failingAsync() {
          callOrder.push('original');
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failingAsync()).rejects.toThrow(testError);
      expect(callOrder).toEqual(['onInvoke', 'original', 'onError', 'finally']);
    });
  });

  describe('only onInvoke hook provided (others omitted)', () => {
    it('should fire onInvoke and execute method normally', () => {
      const onInvoke = vi.fn();

      class TestService {
        @EffectOnMethod({ onInvoke })
        compute(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      const result = service.compute(3, 5);

      expect(result).toBe(8);
      expect(onInvoke).toHaveBeenCalledOnce();
    });
  });

  describe('only onReturn hook provided', () => {
    it('should fire onReturn after method completes', () => {
      const onReturn = vi.fn(({ result }: { result: number }) => result * 2);

      class TestService {
        @EffectOnMethod({ onReturn })
        compute(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      const result = service.compute(3, 5);

      expect(result).toBe(16);
      expect(onReturn).toHaveBeenCalledOnce();
    });
  });

  describe('onError hook receives the thrown error', () => {
    it('should pass the error to onError hook', () => {
      const testError = new Error('specific error');
      const onError = vi.fn(({ error }: { error: unknown }) => { throw error; });

      class TestService {
        @EffectOnMethod({ onError })
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

  describe('finally hook fires on both success and error paths', () => {
    it('should fire finally on success', () => {
      const finallyHook = vi.fn();

      class TestService {
        @EffectOnMethod({ finally: finallyHook })
        succeed() {
          return 'ok';
        }
      }

      const service = new TestService();
      service.succeed();
      expect(finallyHook).toHaveBeenCalledOnce();
    });

    it('should fire finally on error', () => {
      const finallyHook = vi.fn();

      class TestService {
        @EffectOnMethod({ finally: finallyHook })
        fail() {
          throw new Error('fail');
        }
      }

      const service = new TestService();
      expect(() => service.fail()).toThrow();
      expect(finallyHook).toHaveBeenCalledOnce();
    });

    it('should fire finally on async success', async () => {
      const finallyHook = vi.fn();

      class TestService {
        @EffectOnMethod({ finally: finallyHook })
        async succeedAsync() {
          return 'ok';
        }
      }

      const service = new TestService();
      await service.succeedAsync();
      expect(finallyHook).toHaveBeenCalledOnce();
    });

    it('should fire finally on async error', async () => {
      const finallyHook = vi.fn();

      class TestService {
        @EffectOnMethod({ finally: finallyHook })
        async failAsync() {
          throw new Error('fail');
        }
      }

      const service = new TestService();
      await expect(service.failAsync()).rejects.toThrow();
      expect(finallyHook).toHaveBeenCalledOnce();
    });
  });

  describe('onReturn return value replaces method result', () => {
    it('should replace sync method result with onReturn value', () => {
      class TestService {
        @EffectOnMethod({
          onReturn: () => 'replaced',
        })
        original() {
          return 'original';
        }
      }

      const service = new TestService();
      expect(service.original()).toBe('replaced');
    });

    it('should replace async method result with onReturn value', async () => {
      class TestService {
        @EffectOnMethod({
          onReturn: () => 'replaced',
        })
        async originalAsync() {
          return 'original';
        }
      }

      const service = new TestService();
      expect(await service.originalAsync()).toBe('replaced');
    });
  });

  describe('this context is correct inside wrapped method', () => {
    it('should preserve this context for sync methods', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      class TestService {
        value = 42;

        @EffectOnMethod({ onReturn })
        getValue() {
          return this.value;
        }
      }

      const service = new TestService();
      expect(service.getValue()).toBe(42);
    });

    it('should preserve this context for async methods', async () => {
      class TestService {
        value = 'async-value';

        @EffectOnMethod({
          onReturn: ({ result }) => result,
        })
        async getValueAsync() {
          return this.value;
        }
      }

      const service = new TestService();
      expect(await service.getValueAsync()).toBe('async-value');
    });
  });

  describe('EFFECT_APPLIED_KEY is set on wrapped function', () => {
    it('should be retrievable via getMeta on the descriptor', () => {
      class TestService {
        @EffectOnMethod({})
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBe(true);
    });
  });

  describe('metadata from original function is preserved on wrapped function', () => {
    it('should copy _symMeta from original to wrapped function', () => {
      const customKey = Symbol('customMeta');

      class TestService {
        @EffectOnMethod({})
        @SetMeta(customKey, 'preserved-value')
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      expect(getMeta<string>(customKey, descriptor)).toBe('preserved-value');
      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBe(true);
    });

    it('should preserve metadata set via setMeta before wrapping', () => {
      const markerKey = Symbol('marker');

      class TestService {
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      setMeta(markerKey, 'before-wrap', descriptor);

      const decorator = EffectOnMethod({});
      decorator(TestService.prototype, 'myMethod', descriptor);

      expect(getMeta<string>(markerKey, descriptor)).toBe('before-wrap');
    });
  });

  describe('hook that throws propagates error to caller', () => {
    it('should propagate onReturn hook error', () => {
      const hookError = new Error('hook failure');

      class TestService {
        @EffectOnMethod({
          onReturn: () => {
            throw hookError;
          },
        })
        succeed() {
          return 'ok';
        }
      }

      const service = new TestService();
      expect(() => service.succeed()).toThrow(hookError);
    });

    it('should propagate async onReturn hook error', async () => {
      const hookError = new Error('async hook failure');

      class TestService {
        @EffectOnMethod({
          onReturn: () => {
            throw hookError;
          },
        })
        async succeedAsync() {
          return 'ok';
        }
      }

      const service = new TestService();
      await expect(service.succeedAsync()).rejects.toThrow(hookError);
    });

    it('should propagate onError hook error to caller', () => {
      const onErrorHookError = new Error('onError hook error');

      class TestService {
        @EffectOnMethod({
          onError: () => {
            throw onErrorHookError;
          },
        })
        failing() {
          throw new Error('original');
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(onErrorHookError);
    });
  });

  describe('method with no hooks applied (empty options) still executes normally', () => {
    it('should execute sync method normally with empty hooks', () => {
      class TestService {
        @EffectOnMethod({})
        add(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      expect(service.add(2, 3)).toBe(5);
    });

    it('should execute async method normally with empty hooks', async () => {
      class TestService {
        @EffectOnMethod({})
        async addAsync(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      expect(await service.addAsync(2, 3)).toBe(5);
    });
  });

  describe('hook argument signatures', () => {
    it('should pass correct arguments to onInvoke', () => {
      const onInvoke = vi.fn();

      class TestService {
        @EffectOnMethod({ onInvoke })
        greet(name: string, age: number) {
          return `${name} ${age}`;
        }
      }

      const service = new TestService();
      service.greet('Alice', 30);

      expect(onInvoke).toHaveBeenCalledOnce();
      const [context] = onInvoke.mock.calls[0];
      expect(context.args).toEqual({ name: 'Alice', age: 30 });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('greet');
      expect(context.descriptor).toBeDefined();
      expect(typeof context.descriptor.value).toBe('function');
    });

    it('should pass correct arguments to onReturn', () => {
      const onReturn = vi.fn(({ result }: { result: string }) => result);

      class TestService {
        @EffectOnMethod({ onReturn })
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      service.greet('Bob');

      expect(onReturn).toHaveBeenCalledOnce();
      const [context] = onReturn.mock.calls[0];
      expect(context.args).toEqual({ name: 'Bob' });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('greet');
      expect(context.result).toBe('hello Bob');
      expect(context.descriptor).toBeDefined();
    });

    it('should pass correct arguments to onError', () => {
      const testError = new Error('test');
      const onError = vi.fn(({ error }: { error: unknown }) => { throw error; });

      class TestService {
        @EffectOnMethod({ onError })
        failing(input: string) {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing('data')).toThrow(testError);

      expect(onError).toHaveBeenCalledOnce();
      const [context] = onError.mock.calls[0];
      expect(context.args).toEqual({ input: 'data' });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('failing');
      expect(context.error).toBe(testError);
      expect(context.descriptor).toBeDefined();
    });

    it('should pass correct arguments to finally hook', () => {
      const finallyHook = vi.fn();

      class TestService {
        @EffectOnMethod({ finally: finallyHook })
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      service.greet('Charlie');

      expect(finallyHook).toHaveBeenCalledOnce();
      const [context] = finallyHook.mock.calls[0];
      expect(context.args).toEqual({ name: 'Charlie' });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('greet');
      expect(context.descriptor).toBeDefined();
    });
  });

  describe('if no onError hook, the original error is re-thrown', () => {
    it('should re-throw original error when no onError hook is provided', () => {
      const testError = new Error('original error');

      class TestService {
        @EffectOnMethod({})
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
    });

    it('should re-throw original error for async method when no onError hook', async () => {
      const testError = new Error('async original error');

      class TestService {
        @EffectOnMethod({})
        async failingAsync() {
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failingAsync()).rejects.toThrow(testError);
    });
  });

  describe('onError hook can return recovery value', () => {
    it('should return recovery value from onError for sync method', () => {
      class TestService {
        @EffectOnMethod({
          onError: () => 'recovered' as unknown,
        })
        failing(): string {
          throw new Error('fail');
        }
      }

      const service = new TestService();
      expect(service.failing()).toBe('recovered');
    });

    it('should return recovery value from onError for async method', async () => {
      class TestService {
        @EffectOnMethod({
          onError: () => 'recovered' as unknown,
        })
        async failingAsync(): Promise<string> {
          throw new Error('fail');
        }
      }

      const service = new TestService();
      expect(await service.failingAsync()).toBe('recovered');
    });
  });

  describe('async hook optimization: .then/.catch only attached when hooks defined', () => {
    it('should not attach .then when onReturn is undefined (async success path)', async () => {
      const onInvoke = vi.fn();

      class TestService {
        @EffectOnMethod({ onInvoke })
        async fetchData(id: number) {
          return { id, data: 'result' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42, data: 'result' });
      expect(onInvoke).toHaveBeenCalledOnce();
    });

    it('should not attach .catch when onError is undefined (async error path)', async () => {
      const testError = new Error('unhandled async error');

      class TestService {
        @EffectOnMethod({})
        async failingAsync() {
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failingAsync()).rejects.toThrow(testError);
    });

    it('should attach only .then when only onReturn is defined (no onError)', async () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      class TestService {
        @EffectOnMethod({ onReturn })
        async fetchData(id: number) {
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(1);

      expect(result).toEqual({ id: 1 });
      expect(onReturn).toHaveBeenCalledOnce();
    });

    it('should attach only .catch when only onError is defined (no onReturn)', async () => {
      const testError = new Error('async error');
      const onError = vi.fn(({ error }: { error: unknown }) => { throw error; });

      class TestService {
        @EffectOnMethod({ onError })
        async failingAsync() {
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failingAsync()).rejects.toThrow(testError);
      expect(onError).toHaveBeenCalledOnce();
    });

    it('should work with empty hooks on async method (no .then/.catch/.finally)', async () => {
      class TestService {
        @EffectOnMethod({})
        async computeAsync(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      expect(await service.computeAsync(10, 20)).toBe(30);
    });
  });

  describe('exclusionKey parameter', () => {
    it('should mark method with EFFECT_APPLIED_KEY by default', () => {
      class TestService {
        @EffectOnMethod({})
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBe(true);
    });

    it('should mark method with custom exclusionKey when provided', () => {
      const CUSTOM_KEY = Symbol('customApplied');

      class TestService {
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      EffectOnMethod({}, CUSTOM_KEY)(TestService.prototype, 'myMethod', descriptor);

      // Custom key should be set
      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
      // Default EFFECT_APPLIED_KEY should NOT be set
      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBeUndefined();
    });

    it('should allow independent decorators with different exclusionKeys', () => {
      const LOG_KEY = Symbol('logApplied');
      const METRICS_KEY = Symbol('metricsApplied');

      const logOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const metricsOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      class TestService {
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;

      // Apply "Log" decorator with LOG_KEY
      EffectOnMethod({ onReturn: logOnReturn }, LOG_KEY)(
        TestService.prototype,
        'myMethod',
        descriptor,
      );
      // Apply "Metrics" decorator with METRICS_KEY
      EffectOnMethod({ onReturn: metricsOnReturn }, METRICS_KEY)(
        TestService.prototype,
        'myMethod',
        descriptor,
      );

      Object.defineProperty(TestService.prototype, 'myMethod', descriptor);

      const service = new TestService();
      service.myMethod();

      // Both decorators should have fired (no interference)
      expect(logOnReturn).toHaveBeenCalledOnce();
      expect(metricsOnReturn).toHaveBeenCalledOnce();

      // Both keys should be set on the method
      const finalDescriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;
      expect(getMeta<boolean>(LOG_KEY, finalDescriptor)).toBe(true);
      expect(getMeta<boolean>(METRICS_KEY, finalDescriptor)).toBe(true);
    });
  });
});
