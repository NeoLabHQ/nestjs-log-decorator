import { applyToMethod } from './applyToMethod';
import { type LogOptions, NO_LOG_METADATA_KEY } from '../types';

interface Constructor {
  prototype: Record<string, unknown>;
}

/**
 * Applies logging to all methods in a class.
 * @internal
 */
export const applyToClass = (target: Constructor, options: LogOptions): void => {
  const propertyNames = Object.getOwnPropertyNames(target.prototype);

  propertyNames.forEach(propertyName => {
    // Skip constructor
    if (propertyName === 'constructor') return;

    const descriptor = Object.getOwnPropertyDescriptor(target.prototype, propertyName);
    if (!descriptor || typeof descriptor.value !== 'function') return;

    // Skip methods marked with @NoLog()
    const value = descriptor.value as Record<string, unknown>;
    if (value[NO_LOG_METADATA_KEY as unknown as string] === true) return;

    // Apply method decorator logic
    applyToMethod(target.prototype, propertyName, descriptor, options);
    Object.defineProperty(target.prototype, propertyName, descriptor);
  });
};
