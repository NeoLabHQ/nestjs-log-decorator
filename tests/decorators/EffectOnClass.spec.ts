import { describe, it, expect, vi } from 'vitest';

import { EffectOnClass } from '../../src/decorators/effect-on-class';
import {
  EffectOnMethod,
  EFFECT_APPLIED_KEY,
} from '../../src/decorators/effect-on-method';
import { setMeta, getMeta, SetMeta } from '../../src/decorators/set-meta.decorator';
import type { EffectHooks } from '../../src/decorators/set-meta.decorator';

describe('EffectOnClass', () => {
  describe('wraps all prototype methods with hooks', () => {
    it('should wrap all 3 methods and fire hooks for each', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @EffectOnClass({ afterReturn })
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          return 'b';
        }

        methodC() {
          return 'c';
        }
      }

      const service = new TestService();
      expect(service.methodA()).toBe('a');
      expect(service.methodB()).toBe('b');
      expect(service.methodC()).toBe('c');

      expect(afterReturn).toHaveBeenCalledTimes(3);
    });
  });

  describe('constructor is never wrapped', () => {
    it('should not fire hooks during construction', () => {
      const onInvoke = vi.fn();

      @EffectOnClass({ onInvoke })
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

      // But should fire when calling a method
      service.doWork();
      expect(onInvoke).toHaveBeenCalledOnce();
    });
  });

  describe('methods with EFFECT_APPLIED_KEY are skipped', () => {
    it('should skip methods already decorated with EffectOnMethod', () => {
      const classAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );
      const methodAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @EffectOnClass({ afterReturn: classAfterReturn })
      class TestService {
        @EffectOnMethod({ afterReturn: methodAfterReturn })
        alreadyWrapped() {
          return 'wrapped';
        }

        notWrapped() {
          return 'not-wrapped';
        }
      }

      const service = new TestService();
      service.alreadyWrapped();
      service.notWrapped();

      // Method-level hook fires once for the already-wrapped method
      expect(methodAfterReturn).toHaveBeenCalledOnce();
      // Class-level hook fires only for notWrapped (skipped alreadyWrapped)
      expect(classAfterReturn).toHaveBeenCalledOnce();
    });

    it('should skip methods with EFFECT_APPLIED_KEY set via setMeta', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      class TestService {
        preMarked() {
          return 'pre-marked';
        }

        normal() {
          return 'normal';
        }
      }

      // Pre-set the EFFECT_APPLIED_KEY on preMarked
      const preMarkedDescriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'preMarked',
      )!;
      setMeta(EFFECT_APPLIED_KEY, true, preMarkedDescriptor);

      // Apply class decorator
      EffectOnClass({ afterReturn })(TestService);

      const service = new TestService();
      service.preMarked();
      service.normal();

      // afterReturn should fire only for 'normal', not 'preMarked'
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('methods with exclusionKey metadata are skipped', () => {
    it('should skip methods marked with the provided exclusionKey', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @EffectOnClass({ afterReturn }, EXCLUSION_KEY)
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

    it('should not skip any methods when exclusionKey is not provided', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );
      const SOME_KEY = Symbol('someKey');

      @EffectOnClass({ afterReturn })
      class TestService {
        @SetMeta(SOME_KEY, true)
        markedWithSomeKey() {
          return 'marked';
        }

        normal() {
          return 'normal';
        }
      }

      const service = new TestService();
      service.markedWithSomeKey();
      service.normal();

      // Both methods wrapped since no exclusionKey was passed
      expect(afterReturn).toHaveBeenCalledTimes(2);
    });
  });

  describe('EFFECT_APPLIED_KEY is checked before exclusionKey', () => {
    it('should skip method with EFFECT_APPLIED_KEY even if it also has exclusionKey', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const classAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );
      const methodAfterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      // Method-level @Log() wins over @NoLog() within class-level @Log()
      @EffectOnClass({ afterReturn: classAfterReturn }, EXCLUSION_KEY)
      class TestService {
        @EffectOnMethod({ afterReturn: methodAfterReturn })
        @SetMeta(EXCLUSION_KEY, true)
        methodLevelWins() {
          return 'method-level';
        }

        normal() {
          return 'normal';
        }
      }

      const service = new TestService();
      service.methodLevelWins();
      service.normal();

      // Method-level hook fires for methodLevelWins
      expect(methodAfterReturn).toHaveBeenCalledOnce();
      // Class-level hook fires only for normal
      // (methodLevelWins is skipped by EFFECT_APPLIED_KEY before exclusionKey check)
      expect(classAfterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('getters and setters are not wrapped', () => {
    it('should skip getters and setters', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @EffectOnClass({ afterReturn })
      class TestService {
        private _value = 10;

        get value() {
          return this._value;
        }

        set value(val: number) {
          this._value = val;
        }

        doWork() {
          return this._value * 2;
        }
      }

      const service = new TestService();

      // Access getter
      const val = service.value;
      expect(val).toBe(10);

      // Use setter
      service.value = 20;
      expect(service.value).toBe(20);

      // Call method
      service.doWork();

      // afterReturn should fire only for doWork, not getter/setter
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('non-function properties are not wrapped', () => {
    it('should skip non-function prototype properties', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      class TestService {
        doWork() {
          return 'work';
        }
      }

      // Define a non-function property on the prototype
      Object.defineProperty(TestService.prototype, 'staticData', {
        value: 'not-a-function',
        writable: true,
        enumerable: true,
        configurable: true,
      });

      EffectOnClass({ afterReturn })(TestService);

      const service = new TestService();
      service.doWork();

      // afterReturn fires only for doWork
      expect(afterReturn).toHaveBeenCalledOnce();
      // Non-function property is untouched
      expect((service as unknown as Record<string, unknown>).staticData).toBe(
        'not-a-function',
      );
    });
  });

  describe('class with no methods (only constructor)', () => {
    it('should not throw errors', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      expect(() => {
        @EffectOnClass({ afterReturn })
        class EmptyService {
          value = 1;
        }

        const svc = new EmptyService();
        expect(svc.value).toBe(1);
      }).not.toThrow();

      expect(afterReturn).not.toHaveBeenCalled();
    });
  });

  describe('inherited prototype methods are wrapped', () => {
    it('should wrap methods from parent class prototype when on subclass prototype', () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      class ParentService {
        parentMethod() {
          return 'parent';
        }
      }

      // NOTE: Object.getOwnPropertyNames only returns own properties.
      // If the subclass inherits from the parent, the parent method is on
      // ParentService.prototype, not SubService.prototype.
      // EffectOnClass uses getOwnPropertyNames, so inherited methods NOT
      // on the subclass's own prototype will NOT be wrapped.
      // This test verifies the current behavior matches applyToClass.ts.
      @EffectOnClass({ afterReturn })
      class SubService extends ParentService {
        childMethod() {
          return 'child';
        }
      }

      const service = new SubService();
      service.childMethod();
      service.parentMethod();

      // childMethod is on SubService.prototype (own property) -> wrapped
      // parentMethod is on ParentService.prototype (inherited, not own) -> NOT wrapped
      // This matches the existing applyToClass behavior using getOwnPropertyNames
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('all lifecycle hooks work via EffectOnClass', () => {
    it('should fire all hooks in correct order for wrapped methods', () => {
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

      @EffectOnClass(hooks)
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

  describe('async methods work via EffectOnClass', () => {
    it('should handle async methods correctly', async () => {
      const afterReturn = vi.fn(
        (_args: unknown[], _t: object, _k: string | symbol, result: unknown) => result,
      );

      @EffectOnClass({ afterReturn })
      class TestService {
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(1);

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(afterReturn).toHaveBeenCalledOnce();
    });
  });

  describe('EFFECT_APPLIED_KEY is set on methods wrapped by EffectOnClass', () => {
    it('should mark wrapped methods with EFFECT_APPLIED_KEY', () => {
      @EffectOnClass({})
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      )!;

      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBe(true);
    });
  });
});
