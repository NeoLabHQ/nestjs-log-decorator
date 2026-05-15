import type { TypedMethodDecorator } from 'base-decorators'
import type { ValidationError, ValidatorOptions } from 'class-validator'
import { OnInvokeHook } from 'base-decorators'
import { validate } from 'class-validator'
import { createLogWrapper } from 'nestjs-log-decorator'

/**
 * Configuration for the Validate method decorator.
 *
 * @typeParam V - The method arguments tuple type. Inferred from usage.
 * @param validate - Callback that receives the method arguments and should throw if validation fails.
 *                   May be sync or async.
 * @param message - Optional log message written when validation fails.
 */
interface ValidateConfig<V extends unknown[] = unknown[]> {
  validate: (...args: V) => void | Promise<void>
  message?: string
}

/**
 * Configuration for the ValidateObject method decorator.
 *
 * @typeParam V - The method arguments tuple type. Inferred from usage.
 * @param extract - Extracts the object to validate from method arguments.
 * @param handleErrors - Called when class-validator finds violations. Should throw a domain exception.
 * @param validatorOptions - Optional class-validator options (groups, whitelist, etc.).
 * @param message - Optional log message written when validation fails.
 */
interface ValidateObjectConfig<V extends unknown[] = unknown[]> {
  extract: (...args: V) => object
  handleErrors: (args: V, errors: ValidationError[], messages: string[]) => void
  validatorOptions?: ValidatorOptions
  message?: string
}

/**
 * Method decorator that validates an extracted object using class-validator BEFORE
 * the decorated method executes.
 *
 * The `extract` callback pulls an object from the method arguments. That object is
 * passed to class-validator's `validate()`. When violations are found, `handleErrors`
 * is called with the original args, the raw ValidationError array, and pre-formatted
 * human-readable messages. The `handleErrors` callback should throw a domain exception.
 *
 * Delegates to `Validate` internally, constructing a validation callback that performs
 * class-validator checks and calls `handleErrors` when violations are found.
 *
 * @param config - Configuration with extract, handleErrors, optional validatorOptions and message
 * @returns A method decorator that wraps the target method with object validation
 *
 * @example
 * ```ts
 * function ValidateApplicantData() {
 *   return ValidateObject<[CrifApplicantData, string]>({
 *     message: 'CRIF applicant data validation failed',
 *     extract: (data) => data,
 *     handleErrors: ([, userId], errors, messages) => {
 *       throw new CreditBureauValidationException(userId, messages)
 *     },
 *   })
 * }
 * ```
 */
// eslint-disable-next-line ts/no-unnecessary-type-parameters
function ValidateObject<T extends object = object, TArgs extends unknown[] = unknown[], TReturn extends Promise<unknown> = Promise<unknown>>(config: ValidateObjectConfig<TArgs>): TypedMethodDecorator<TArgs, TReturn> {
  const validateConfig: ValidateConfig<TArgs> = {
    async validate(...args: TArgs) {
      const objectToValidate = config.extract(...args)
      const errors = await validate(objectToValidate, config.validatorOptions)

      if (errors.length > 0) {
        const messages = formatValidationMessages(errors)

        config.handleErrors(args, errors, messages)
      }
    },
  }

  if (config.message) {
    validateConfig.message = config.message
  }

  return Validate<T, TArgs, TReturn>(validateConfig)
}

/** Unique exclusion key for Validate decorators, isolating them from other Effect-based decorators. */
const VALIDATE_EXCLUSION_KEY: unique symbol = Symbol('validate')

/**
 * Method decorator that runs a validation callback BEFORE the decorated method.
 *
 * The validate callback receives all method arguments and should throw
 * if validation fails. Supports both sync and async callbacks.
 *
 * Uses the `onInvoke` lifecycle hook from `base-decorators` for pre-execution validation
 * and `createLogWrapper` from `nestjs-log-decorator` for consistent logging.
 *
 * @param config - Validation configuration with callback and optional log message
 * @returns A method decorator that wraps the target method with pre-validation
 *
 * @example
 * ```ts
 * function ValidateScoringInput() {
 *   return Validate<[CreditBureauData, string]>({
 *     message: 'Credit score validation failed',
 *     validate(creditBureauData, userId) {
 *       if (!creditBureauData.rawCreditHistoryXML) {
 *         throw new CreditScoreValidationException(userId, 'Missing credit history XML')
 *       }
 *     },
 *   })
 * }
 * ```
 */
// eslint-disable-next-line ts/no-unnecessary-type-parameters
function Validate<T extends object = object, TArgs extends unknown[] = unknown[], TReturn extends Promise<unknown> = Promise<unknown>>(config: ValidateConfig<TArgs>): TypedMethodDecorator<TArgs, TReturn> {
  return OnInvokeHook<T, TArgs, Promise<unknown>>(async ({ target, className, propertyKey, args, argsObject }): Promise<void> => {
    try {
      await config.validate(...args)
    }
    catch (error: unknown) {
      const logger = createLogWrapper(target, className, propertyKey as string, argsObject)

      logger.error(error, config.message)
      throw error
    }
  }, VALIDATE_EXCLUSION_KEY)
}

/**
 * Formats validation errors into human-readable messages.
 * Each message follows the pattern "property: constraint1, constraint2".
 *
 * @param errors - Array of class-validator ValidationError instances
 * @returns Array of formatted error message strings
 */
function formatValidationMessages(errors: ValidationError[]): string[] {
  return errors.map((validationError) => {
    const constraints = validationError.constraints
      ? Object.values(validationError.constraints)
      : ['Invalid value']

    return `${validationError.property}: ${constraints.join(', ')}`
  })
}

export { Validate, ValidateObject }
export type { ValidateConfig, ValidateObjectConfig }
