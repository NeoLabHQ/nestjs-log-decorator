import { describe, it, expect } from 'vitest';

import { setMeta, getMeta, SetMeta } from '../../src/decorators/set-meta.decorator';

describe('SetMeta metadata primitives', () => {
  describe('setMeta / getMeta round-trip', () => {
    it('should store and retrieve a boolean value', () => {
      const key = Symbol('testKey');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(key, true, descriptor);

      expect(getMeta<boolean>(key, descriptor)).toBe(true);
    });

    it('should store and retrieve a string value', () => {
      const key = Symbol('stringKey');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(key, 'hello', descriptor);

      expect(getMeta<string>(key, descriptor)).toBe('hello');
    });

    it('should store and retrieve an object value', () => {
      const key = Symbol('objKey');
      const payload = { foo: 'bar', count: 42 };
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(key, payload, descriptor);

      expect(getMeta(key, descriptor)).toBe(payload);
    });

    it('should overwrite existing value for the same key', () => {
      const key = Symbol('overwriteKey');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(key, 'first', descriptor);
      setMeta(key, 'second', descriptor);

      expect(getMeta<string>(key, descriptor)).toBe('second');
    });
  });

  describe('getMeta with missing metadata', () => {
    it('should return undefined when no metadata has been set', () => {
      const key = Symbol('missingKey');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      expect(getMeta(key, descriptor)).toBeUndefined();
    });

    it('should return undefined for unset key even when other keys exist', () => {
      const setKey = Symbol('setKey');
      const missingKey = Symbol('missingKey');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(setKey, 'value', descriptor);

      expect(getMeta(missingKey, descriptor)).toBeUndefined();
    });

    it('should return undefined when descriptor is undefined', () => {
      const key = Symbol('anyKey');

      expect(getMeta(key, undefined as unknown as PropertyDescriptor)).toBeUndefined();
    });

    it('should return undefined when descriptor.value is undefined', () => {
      const key = Symbol('anyKey');
      const descriptor: PropertyDescriptor = { value: undefined };

      expect(getMeta(key, descriptor)).toBeUndefined();
    });

    it('should return undefined when descriptor.value is null', () => {
      const key = Symbol('anyKey');
      const descriptor: PropertyDescriptor = { value: null };

      expect(getMeta(key, descriptor)).toBeUndefined();
    });
  });

  describe('multiple metadata keys on same function', () => {
    it('should support multiple keys on a single descriptor without conflict', () => {
      const keyA = Symbol('keyA');
      const keyB = Symbol('keyB');
      const keyC = Symbol('keyC');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(keyA, 'alpha', descriptor);
      setMeta(keyB, 42, descriptor);
      setMeta(keyC, false, descriptor);

      expect(getMeta<string>(keyA, descriptor)).toBe('alpha');
      expect(getMeta<number>(keyB, descriptor)).toBe(42);
      expect(getMeta<boolean>(keyC, descriptor)).toBe(false);
    });

    it('should not create _symMeta as enumerable property', () => {
      const key = Symbol('enumTest');
      const fn = () => {};
      const descriptor: PropertyDescriptor = { value: fn, writable: true, configurable: true };

      setMeta(key, true, descriptor);

      const propDescriptor = Object.getOwnPropertyDescriptor(fn, '_symMeta');
      expect(propDescriptor).toBeDefined();
      expect(propDescriptor!.enumerable).toBe(false);
    });
  });

  describe('SetMeta decorator factory', () => {
    it('should set metadata retrievable by getMeta', () => {
      const key = Symbol('decoratorKey');

      class TestClass {
        @SetMeta(key, 'decorated')
        myMethod() {
          return 'result';
        }
      }

      const instance = new TestClass();
      const descriptor = Object.getOwnPropertyDescriptor(
        TestClass.prototype,
        'myMethod',
      )!;

      expect(getMeta<string>(key, descriptor)).toBe('decorated');
      expect(instance.myMethod()).toBe('result');
    });

    it('should not alter the method behavior', () => {
      const key = Symbol('noAlter');

      class TestClass {
        @SetMeta(key, true)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const instance = new TestClass();
      expect(instance.add(3, 4)).toBe(7);
    });

    it('should work with multiple SetMeta decorators on the same method', () => {
      const keyA = Symbol('multiA');
      const keyB = Symbol('multiB');

      class TestClass {
        @SetMeta(keyA, 'valueA')
        @SetMeta(keyB, 'valueB')
        myMethod() {
          return 'result';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestClass.prototype,
        'myMethod',
      )!;

      expect(getMeta<string>(keyA, descriptor)).toBe('valueA');
      expect(getMeta<string>(keyB, descriptor)).toBe('valueB');
    });

    it('should preserve this context inside the decorated method', () => {
      const key = Symbol('contextKey');

      class TestClass {
        value = 42;

        @SetMeta(key, true)
        getValue() {
          return this.value;
        }
      }

      const instance = new TestClass();
      expect(instance.getValue()).toBe(42);
    });
  });
});
