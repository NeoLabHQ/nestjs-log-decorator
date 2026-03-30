export type LogArgsFormatter<TArgs extends unknown[]> = (...args: TArgs) => string | number | Record<string, unknown> | undefined;
export type LogResultFormatter<TResult = unknown> = (result: TResult) => unknown;

/**
 * Configuration options for the Log decorator.
 */
export interface LogOptions<TArgs extends unknown[] = unknown[], TResult = unknown> {
  /**
   * When true, logs method invocation with arguments.
   * When false or not set, only logs success and error states.
   * @default false
   */
  onInvoke?: boolean;

  /**
   * Function to format arguments for logging.
   * Useful for excluding large objects, sensitive data, or logging only specific arguments.
   *
   * @example
   * // Exclude large objects from logs
   * @Log({ args: (loanId: number, loanData: CloudbankinLoan) => ({ loanId }) })
   *
   * @example
   * // Log only specific arguments
   * @Log({ args: (id: number, name: string, details: object) => ({ id, name }) })
   *
   * @param args - The method arguments to format.
   * @returns Formatted arguments as string, number, object, or undefined
   */
  args?: LogArgsFormatter<TArgs>;

  /**
   * Controls how successful method result is logged.
   *
   * - `true`: logs the returned result value as-is
   * - formatter function: receives the method result and returns a formatted value
   *
   * @example
   * // Log raw result
   * @Log({ result: true })
   *
   * @example
   * // Log only selected result fields
   * @Log({ result: (res: { id: number; data: unknown }) => ({ id: res.id }) })
   */
  result?: true | LogResultFormatter<TResult>;
}

/**
 * Symbol used to mark methods that should not be logged
 * @internal
 */
export const NO_LOG_METADATA_KEY = Symbol('noLog');
