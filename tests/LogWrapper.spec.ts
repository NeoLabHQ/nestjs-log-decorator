import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';

import { createLogWrapper, isLoggable, LogWrapper } from '../src/LogWrapper';
import { buildArgsObject } from '../src/decorators';

/**
 * Tests for LogWrapper auto-injection behavior (Step 6).
 *
 * Validates that createLogWrapper auto-injects a NestJS Logger
 * when the target instance does not have a logger property,
 * instead of throwing an error.
 */
describe('createLogWrapper', () => {
  describe('auto-injection when logger is missing', () => {
    it('should not throw when instance has no logger property', () => {
      const instance: Record<string, unknown> = {};

      expect(() => createLogWrapper(instance, 'TestClass', 'testMethod', undefined)).not.toThrow();
    });

    it('should auto-inject a Logger instance when isLoggable returns false', () => {
      const instance: Record<string, unknown> = {};

      createLogWrapper(instance, 'TestClass', 'testMethod', undefined);

      expect(instance.logger).toBeDefined();
      expect(instance.logger).toBeInstanceOf(Logger);
    });

    it('should inject Logger with the class name as context', () => {
      const instance: Record<string, unknown> = {};

      createLogWrapper(instance, 'MyService', 'doWork', undefined);

      // The Logger instance should have been created with 'MyService' as context
      expect(instance.logger).toBeInstanceOf(Logger);
    });

    it('should return a valid LogWrapper after auto-injection', () => {
      const instance: Record<string, unknown> = {};

      const wrapper = createLogWrapper(instance, 'TestClass', 'doStuff', { id: 1 });

      expect(wrapper).toBeInstanceOf(LogWrapper);
    });
  });

  describe('existing logger preserved', () => {
    it('should use existing logger when isLoggable returns true', () => {
      const mockLogger = {
        log: vi.fn(),
        error: vi.fn(),
      } as unknown as Logger;

      const instance = { logger: mockLogger };

      const wrapper = createLogWrapper(instance, 'TestClass', 'testMethod', undefined);

      // Verify no new logger was injected (the original mock is still there)
      expect(instance.logger).toBe(mockLogger);
      expect(wrapper).toBeInstanceOf(LogWrapper);
    });

    it('should not overwrite an existing logger property', () => {
      const mockLogger = {
        log: vi.fn(),
        error: vi.fn(),
      } as unknown as Logger;

      const instance = { logger: mockLogger };

      createLogWrapper(instance, 'SomeService', 'someMethod', { key: 'value' });

      expect(instance.logger).toBe(mockLogger);
    });
  });
});

describe('isLoggable', () => {
  it('should return true when instance has a logger property', () => {
    const instance = { logger: new Logger('Test') };
    expect(isLoggable(instance)).toBe(true);
  });

  it('should return false when instance has no logger property', () => {
    const instance = {};
    expect(isLoggable(instance)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isLoggable(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isLoggable(undefined)).toBe(false);
  });

  it('should return false for non-object types', () => {
    expect(isLoggable('string')).toBe(false);
    expect(isLoggable(42)).toBe(false);
  });
});

describe('buildArgsObject', () => {
  it('should remain unchanged and map parameter names to values', () => {
    const result = buildArgsObject(['id', 'name'], [1, 'John']);
    expect(result).toEqual({ id: 1, name: 'John' });
  });

  it('should return undefined for empty args and params', () => {
    const result = buildArgsObject([], []);
    expect(result).toBeUndefined();
  });
});
