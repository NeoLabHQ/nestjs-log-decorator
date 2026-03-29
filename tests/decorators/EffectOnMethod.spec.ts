import { describe, it, expect, vi } from 'vitest';

import {
  EffectOnMethod,
  EFFECT_APPLIED_KEY,
} from '../../src/decorators/effect-on-method';
import { setMeta, getMeta, SetMeta } from '../../src/decorators/set-meta.decorator';
import type { EffectHooks } from '../../src/decorators/set-meta.decorator';

describe('EffectOnMethod', () => {
  describe('sync method with all 4 hooks fires in correct order', () => {
    it('should fire hooks in order: onInvoke, original, afterReturn, finally', () => {
      const callOrder: string[] = [];

      const hooks: EffectHooks<string> = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _target, _key, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        onError: (_args, _target, _key, error) => {
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
      expect(callOrder).toEqual(['onInvoke', 'original', 'afterReturn', 'finally']);
    });
  });

  describe('sync method error path fires hooks in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onError, finally', () => {
      const callOrder: string[] = [];
      const testError = new Error('sync failure');

      const hooks: EffectHooks = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _target, _key, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        onError: (_args, _target, _key, error) => {
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
    it('should fire hooks in order: onInvoke, original, afterReturn, finally', async () => {
      const callOrder: string[] = [];

      const hooks: EffectHooks<string> = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _target, _key, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        onError: (_args, _target, _key, error) => {
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
      expect(callOrder).toEqual(['onInvoke', 'original', 'afterReturn', 'finally']);
    });
  });

  describe('async method error path fires hooks in correct order', () => {
    it('should fire hooks in order: onInvoke, original, onError, finally', async () => {
      const callOrder: string[] = [];
      const testError = new Error('async failure');

      const hooks: EffectHooks = {
        onInvoke: () => callOrder.push('onInvoke'),
        afterReturn: (_args, _target, _key, result) => {
          callOrder.push('afterReturn');
          return result;
        },
        onError: (_args, _target, _key, error) => {
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

  describe('only afterReturn hook provided', () => {
    it('should fire afterReturn after method completes', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: number) => result * 2,
      );

      class TestService {
        @EffectOnMethod({ afterReturn })
        compute(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      const result = service.compute(3, 5);

      expect(result).toBe(16);
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('onError hook receives the thrown error', () => {
    it('should pass the error to onError hook', () => {
      const testError = new Error('specific error');
      const onError = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown) => {
          throw error;
        },
      );

      class TestService {
        @EffectOnMethod({ onError })
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

  describe('afterReturn return value replaces method result', () => {
    it('should replace sync method result with afterReturn value', () => {
      class TestService {
        @EffectOnMethod({
          afterReturn: (_args, _t, _k, _result) => 'replaced',
        })
        original() {
          return 'original';
        }
      }

      const service = new TestService();
      expect(service.original()).toBe('replaced');
    });

    it('should replace async method result with afterReturn value', async () => {
      class TestService {
        @EffectOnMethod({
          afterReturn: (_args, _t, _k, _result) => 'replaced',
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
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      class TestService {
        value = 42;

        @EffectOnMethod({ afterReturn })
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
          afterReturn: (_args, _t, _k, result) => result,
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
    it('should propagate afterReturn hook error', () => {
      const hookError = new Error('hook failure');

      class TestService {
        @EffectOnMethod({
          afterReturn: () => {
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

    it('should propagate async afterReturn hook error', async () => {
      const hookError = new Error('async hook failure');

      class TestService {
        @EffectOnMethod({
          afterReturn: () => {
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
      const [args, target, propertyKey, descriptor] = onInvoke.mock.calls[0];
      expect(args).toEqual(['Alice', 30]);
      expect(target).toBe(service);
      expect(propertyKey).toBe('greet');
      expect(descriptor).toBeDefined();
      expect(typeof descriptor.value).toBe('function');
    });

    it('should pass correct arguments to afterReturn', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: string, _d: PropertyDescriptor) => result,
      );

      class TestService {
        @EffectOnMethod({ afterReturn })
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      service.greet('Bob');

      expect(afterReturn).toHaveBeenCalledOnce();
      const [args, target, propertyKey, result, descriptor] = afterReturn.mock.calls[0];
      expect(args).toEqual(['Bob']);
      expect(target).toBe(service);
      expect(propertyKey).toBe('greet');
      expect(result).toBe('hello Bob');
      expect(descriptor).toBeDefined();
    });

    it('should pass correct arguments to onError', () => {
      const testError = new Error('test');
      const onError = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, error: unknown, _d: PropertyDescriptor) => {
          throw error;
        },
      );

      class TestService {
        @EffectOnMethod({ onError })
        failing(input: string) {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing('data')).toThrow(testError);

      expect(onError).toHaveBeenCalledOnce();
      const [args, target, propertyKey, error, descriptor] = onError.mock.calls[0];
      expect(args).toEqual(['data']);
      expect(target).toBe(service);
      expect(propertyKey).toBe('failing');
      expect(error).toBe(testError);
      expect(descriptor).toBeDefined();
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
      const [args, target, propertyKey, descriptor] = finallyHook.mock.calls[0];
      expect(args).toEqual(['Charlie']);
      expect(target).toBe(service);
      expect(propertyKey).toBe('greet');
      expect(descriptor).toBeDefined();
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
});
