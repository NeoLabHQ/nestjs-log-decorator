import { describe, it, expect } from 'vitest';

import { getParameterNames } from '../src/decorators/getParameterNames';

/** Helper to cast typed functions to the expected signature. */
const asFunc = (fn: Function) => fn as (...args: unknown[]) => unknown;

describe('getParameterNames', () => {
  it('should extract parameter names from a regular function', () => {
    function example(id: number, name: string) {
      return { id, name };
    }

    expect(getParameterNames(asFunc(example))).toEqual(['id', 'name']);
  });

  it('should extract parameter names from an arrow function', () => {
    const fn = (x: number, y: string) => ({ x, y });

    expect(getParameterNames(asFunc(fn))).toEqual(['x', 'y']);
  });

  it('should return empty array for function with no parameters', () => {
    function noArgs() {
      return 42;
    }

    expect(getParameterNames(asFunc(noArgs))).toEqual([]);
  });

  it('should strip TypeScript type annotations', () => {
    function typed(id: number, name: string) {
      return { id, name };
    }

    const result = getParameterNames(asFunc(typed));
    expect(result).toEqual(['id', 'name']);
  });

  it('should strip default value expressions', () => {
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    function withDefaults(id: number = 0, name: string = 'default') {
      return { id, name };
    }

    const result = getParameterNames(asFunc(withDefaults));
    expect(result[0]).toBe('id');
    expect(result[1]).toBe('name');
  });

  it('should handle a single parameter', () => {
    function single(value: unknown) {
      return value;
    }

    expect(getParameterNames(asFunc(single))).toEqual(['value']);
  });

  it('should handle parameters with underscores', () => {
    function underscored(_id: number, _name: string) {
      return { _id, _name };
    }

    expect(getParameterNames(asFunc(underscored))).toEqual(['_id', '_name']);
  });

  it('should handle many parameters', () => {
    function many(a: number, b: string, c: boolean, d: object, e: unknown) {
      return { a, b, c, d, e };
    }

    expect(getParameterNames(asFunc(many))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
