/**
 * Extracts parameter names from a function's string representation.
 *
 * Parses the function's `toString()` output to identify parameter names,
 * stripping TypeScript type annotations and default value expressions.
 *
 * @param func - The function to extract parameter names from
 * @returns Array of parameter names in declaration order
 *
 * @example
 * function example(id: number, name: string = 'default') {}
 * getParameterNames(example) // Returns: ['id', 'name']
 */
export const getParameterNames = (func: (...args: unknown[]) => unknown): string[] => {
  const funcStr = func.toString();
  const match = funcStr.match(/\(([^)]*)\)/);

  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map(param => param.trim().split(/[=:]/)[0].trim())
    .filter(param => param.length > 0);
};
