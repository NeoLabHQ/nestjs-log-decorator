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
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn })
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

      expect(onReturn).toHaveBeenCalledTimes(3);
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
      const classOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const methodOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn: classOnReturn })
      class TestService {
        @EffectOnMethod({ onReturn: methodOnReturn })
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
      expect(methodOnReturn).toHaveBeenCalledOnce();
      // Class-level hook fires only for notWrapped (skipped alreadyWrapped)
      expect(classOnReturn).toHaveBeenCalledOnce();
    });

    it('should skip methods with EFFECT_APPLIED_KEY set via setMeta', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

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
      EffectOnClass({ onReturn })(TestService);

      const service = new TestService();
      service.preMarked();
      service.normal();

      // onReturn should fire only for 'normal', not 'preMarked'
      expect(onReturn).toHaveBeenCalledOnce();
    });
  });

  describe('methods with exclusionKey metadata are skipped', () => {
    it('should skip methods marked with the provided exclusionKey', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn }, EXCLUSION_KEY)
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

    it('should not skip any methods when exclusionKey is not provided', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);
      const SOME_KEY = Symbol('someKey');

      @EffectOnClass({ onReturn })
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
      expect(onReturn).toHaveBeenCalledTimes(2);
    });
  });

  describe('method-level decorator prevents class-level double-wrap', () => {
    it('should skip method marked with exclusionKey even when also decorated at method level', () => {
      const EXCLUSION_KEY = Symbol('noEffect');
      const classOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const methodOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      // Method-level decorator wins over class-level decorator
      @EffectOnClass({ onReturn: classOnReturn }, EXCLUSION_KEY)
      class TestService {
        @EffectOnMethod({ onReturn: methodOnReturn })
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
      expect(methodOnReturn).toHaveBeenCalledOnce();
      // Class-level hook fires only for normal
      // (methodLevelWins is skipped because EXCLUSION_KEY metadata is set)
      expect(classOnReturn).toHaveBeenCalledOnce();
    });
  });

  describe('getters and setters are not wrapped', () => {
    it('should skip getters and setters', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn })
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

      // onReturn should fire only for doWork, not getter/setter
      expect(onReturn).toHaveBeenCalledOnce();
    });
  });

  describe('non-function properties are not wrapped', () => {
    it('should skip non-function prototype properties', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

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

      EffectOnClass({ onReturn })(TestService);

      const service = new TestService();
      service.doWork();

      // onReturn fires only for doWork
      expect(onReturn).toHaveBeenCalledOnce();
      // Non-function property is untouched
      expect((service as unknown as Record<string, unknown>).staticData).toBe(
        'not-a-function',
      );
    });
  });

  describe('class with no methods (only constructor)', () => {
    it('should not throw errors', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      expect(() => {
        @EffectOnClass({ onReturn })
        class EmptyService {
          value = 1;
        }

        const svc = new EmptyService();
        expect(svc.value).toBe(1);
      }).not.toThrow();

      expect(onReturn).not.toHaveBeenCalled();
    });
  });

  describe('inherited prototype methods are wrapped', () => {
    it('should wrap methods from parent class prototype when on subclass prototype', () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

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
      @EffectOnClass({ onReturn })
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
      expect(onReturn).toHaveBeenCalledOnce();
    });
  });

  describe('all lifecycle hooks work via EffectOnClass', () => {
    it('should fire all hooks in correct order for wrapped methods', () => {
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
      expect(callOrder).toEqual(['onInvoke', 'original', 'onReturn', 'finally']);
    });
  });

  describe('async methods work via EffectOnClass', () => {
    it('should handle async methods correctly', async () => {
      const onReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn })
      class TestService {
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(1);

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(onReturn).toHaveBeenCalledOnce();
    });
  });

  describe('EFFECT_APPLIED_KEY is set on methods wrapped by EffectOnClass', () => {
    it('should mark wrapped methods with EFFECT_APPLIED_KEY by default', () => {
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

    it('should mark methods with custom exclusionKey instead of EFFECT_APPLIED_KEY', () => {
      const CUSTOM_KEY = Symbol('customApplied');

      @EffectOnClass({}, CUSTOM_KEY)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      )!;

      // Custom key should be set
      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
      // Default EFFECT_APPLIED_KEY should NOT be set
      expect(getMeta<boolean>(EFFECT_APPLIED_KEY, descriptor)).toBeUndefined();
    });
  });

  describe('independent decorators with different exclusionKeys do not interfere', () => {
    it('should allow two class-level decorators to both wrap methods', () => {
      const LOG_KEY = Symbol('logApplied');
      const METRICS_KEY = Symbol('metricsApplied');

      const logOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const metricsOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      // Apply two independent class-level decorators
      @EffectOnClass({ onReturn: metricsOnReturn }, METRICS_KEY)
      @EffectOnClass({ onReturn: logOnReturn }, LOG_KEY)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const service = new TestService();
      service.doWork();

      // Both decorators should have fired because they use different keys
      expect(logOnReturn).toHaveBeenCalledOnce();
      expect(metricsOnReturn).toHaveBeenCalledOnce();
    });

    it('should skip methods decorated by same exclusionKey but not by different key', () => {
      const LOG_KEY = Symbol('logApplied');
      const METRICS_KEY = Symbol('metricsApplied');

      const classLogOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const methodLogOnReturn = vi.fn(({ result }: { result: unknown }) => result);
      const metricsOnReturn = vi.fn(({ result }: { result: unknown }) => result);

      @EffectOnClass({ onReturn: metricsOnReturn }, METRICS_KEY)
      @EffectOnClass({ onReturn: classLogOnReturn }, LOG_KEY)
      class TestService {
        @EffectOnMethod({ onReturn: methodLogOnReturn }, LOG_KEY)
        decoratedMethod() {
          return 'decorated';
        }

        plainMethod() {
          return 'plain';
        }
      }

      const service = new TestService();
      service.decoratedMethod();
      service.plainMethod();

      // Method-level Log fires for decoratedMethod
      expect(methodLogOnReturn).toHaveBeenCalledOnce();
      // Class-level Log skips decoratedMethod (same LOG_KEY), fires for plainMethod
      expect(classLogOnReturn).toHaveBeenCalledOnce();
      // Metrics fires for both (uses METRICS_KEY, not LOG_KEY)
      expect(metricsOnReturn).toHaveBeenCalledTimes(2);
    });
  });
});
