import { buildArgsObject, createLogWrapper, LogWrapper } from '../LogWrapper';
import type { LogOptions } from '../types';

type MethodFunction = (...args: unknown[]) => unknown;

/**
 * Applies logging to a single method.
 * @internal
 */
export const applyToMethod = (
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
  { onInvoke: shouldLogInvoke = false, args: formatArgs }: LogOptions = {},
): PropertyDescriptor => {
  const originalMethod = descriptor.value as MethodFunction;
  const parameterNames = getParameterNames(originalMethod);

  descriptor.value = function (...args: unknown[]): unknown {
    const argsObject = formatArgs ? formatArgs(...args) : buildArgsObject(parameterNames, args);

    const logWrapper = createLogWrapper(this, target.constructor.name, propertyKey, argsObject);

    if (shouldLogInvoke) {
      logWrapper.invoked();
    }

    try {
      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return handleAsyncExecution(result, logWrapper);
      }

      logWrapper.success();
      return result;
    } catch (error) {
      logWrapper.error(error);
      throw error;
    }
  };

  return descriptor;
};

/**
 * Extracts parameter names from a function signature.
 *
 * This function parses the function's string representation to extract
 * parameter names, handling TypeScript type annotations and default values.
 *
 * @param func - The function to extract parameter names from
 * @returns Array of parameter names
 *
 * @example
 * function example(id: number, name: string = 'default') {}
 * getParameterNames(example) // Returns: ['id', 'name']
 *
 * @internal
 */
export const getParameterNames = (func: MethodFunction): string[] => {
  const funcStr = func.toString();
  const match = funcStr.match(/\(([^)]*)\)/);

  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map(param => param.trim().split(/[=:]/)[0].trim())
    .filter(param => param.length > 0);
};

/**
 * Handles execution of async methods with proper logging.
 * @internal
 */
export const handleAsyncExecution = (result: Promise<unknown>, logWrapper: LogWrapper): Promise<unknown> => {
  return result
    .then((value: unknown) => {
      logWrapper.success();
      return value;
    })
    .catch((error: unknown) => {
      logWrapper.error(error);
      throw error;
    });
};
