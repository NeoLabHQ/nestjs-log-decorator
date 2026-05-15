import { Logger } from '@nestjs/common'
import { Catch } from '@/error-handling/catch.decorator'

/** Silenced NestJS logger for test services that use the Catch decorator. */
const silentLogger = new Logger('TestService')
silentLogger.log = jest.fn()
silentLogger.error = jest.fn()
silentLogger.warn = jest.fn()

class CustomError extends Error {
  override name = 'CustomError'
}

class AnotherError extends Error {
  override name = 'AnotherError'
}

class SubCustomError extends CustomError {
  override name = 'SubCustomError'
}

describe('Catch decorator', () => {
  describe('with specific error type (errorType provided)', () => {
    it('should catch errors matching the specified type', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: handler })
        async doWork(): Promise<string> {
          throw new CustomError('test error')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        expect.any(CustomError),
        [],
      )
    })

    it('should catch subclass errors when parent class is specified', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: handler })
        async doWork(): Promise<string> {
          throw new SubCustomError('sub error')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        expect.any(SubCustomError),
        [],
      )
    })

    it('should re-throw errors not matching the specified type', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: handler })
        async doWork(): Promise<string> {
          throw new AnotherError('wrong type')
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow(AnotherError)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should re-throw generic Error when specific type is expected', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: handler })
        async doWork(): Promise<string> {
          throw new Error('generic error')
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow(Error)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('catch-all (no errorType parameter)', () => {
    it('should catch all errors when errorType is not provided', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler })
        async doWork(): Promise<string> {
          throw new CustomError('any error')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        expect.any(CustomError),
        [],
      )
    })

    it('should catch generic Error when errorType is not provided', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler })
        async doWork(): Promise<string> {
          throw new Error('generic')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        expect.any(Error),
        [],
      )
    })
  })

  describe('handler arguments', () => {
    it('should pass the original method arguments to the handler', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler })
        async doWork(_userId: string, _count: number): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork('user-123', 42)

      expect(handler).toHaveBeenCalledWith(
        expect.any(Error),
        ['user-123', 42],
      )
    })
  })

  describe('this context preservation', () => {
    it('should bind the handler to the class instance', async () => {
      let capturedThis: unknown = null

      class TestService {
        readonly logger = silentLogger
        readonly serviceName = 'MyService'

        @Catch({
          handle(this: TestService) {
            capturedThis = this
          },
        })
        async doWork(): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(capturedThis).toBe(service)
    })

    it('should allow the handler to access instance properties', async () => {
      let capturedName = ''

      class TestService {
        readonly logger = silentLogger
        readonly serviceName = 'MyService'

        @Catch({
          handle(this: TestService) {
            capturedName = this.serviceName
          },
        })
        async doWork(): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(capturedName).toBe('MyService')
    })
  })

  describe('stacking multiple decorators', () => {
    it('should handle different error types with stacked decorators', async () => {
      const customHandler = jest.fn()
      const anotherHandler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: customHandler })
        @Catch({ on: AnotherError, handle: anotherHandler })
        async doWork(errorType: string): Promise<string> {
          if (errorType === 'custom') {
            throw new CustomError('custom error')
          }

          throw new AnotherError('another error')
        }
      }

      const service = new TestService()

      await service.doWork('another')

      expect(anotherHandler).toHaveBeenCalledWith(
        expect.any(AnotherError),
        ['another'],
      )
      expect(customHandler).not.toHaveBeenCalled()
    })

    it('should propagate to outer decorator when inner does not match', async () => {
      const customHandler = jest.fn()
      const anotherHandler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: customHandler })
        @Catch({ on: AnotherError, handle: anotherHandler })
        async doWork(): Promise<string> {
          throw new CustomError('custom error')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(anotherHandler).not.toHaveBeenCalled()
      expect(customHandler).toHaveBeenCalledWith(
        expect.any(CustomError),
        [],
      )
    })

    it('should re-throw when no stacked decorator matches', async () => {
      const customHandler = jest.fn()
      const anotherHandler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: customHandler })
        @Catch({ on: AnotherError, handle: anotherHandler })
        async doWork(): Promise<string> {
          throw new Error('unmatched error')
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow('unmatched error')
      expect(customHandler).not.toHaveBeenCalled()
      expect(anotherHandler).not.toHaveBeenCalled()
    })

    it('should use catch-all as the outermost handler with specific types inner', async () => {
      const specificHandler = jest.fn()
      const catchAllHandler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: catchAllHandler })
        @Catch({ on: CustomError, handle: specificHandler })
        async doWork(): Promise<string> {
          throw new Error('generic error')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(specificHandler).not.toHaveBeenCalled()
      expect(catchAllHandler).toHaveBeenCalledWith(
        expect.any(Error),
        [],
      )
    })
  })

  describe('successful method execution', () => {
    it('should not invoke handler when method succeeds', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler })
        async doWork(): Promise<string> {
          return 'success'
        }
      }

      const service = new TestService()
      const result = await service.doWork()

      expect(result).toBe('success')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should return the original value when method succeeds', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: CustomError, handle: handler })
        async doWork(): Promise<number> {
          return 42
        }
      }

      const service = new TestService()
      const result = await service.doWork()

      expect(result).toBe(42)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('handler return value', () => {
    it('should return undefined when handler does not return a value', async () => {
      const handler = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler })
        async doWork(): Promise<string | undefined> {
          throw new Error('fail')
        }
      }

      const service = new TestService()
      const result = await service.doWork()

      expect(result).toBeUndefined()
    })
  })

  describe('with formatArgs option', () => {
    it('should use formatArgs to format the logged arguments when provided', async () => {
      const handler = jest.fn()
      const formatArgs = (userId: string, _count: number) => ({ userId })

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: handler, formatArgs })
        async doWork(_userId: string, _count: number): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork('user-123', 42)

      expect(handler).toHaveBeenCalledWith(
        expect.any(Error),
        ['user-123', 42],
      )
    })
  })

  describe('with predicate function (on: (error) => boolean)', () => {
    it('should catch errors when predicate returns true', async () => {
      const handler = jest.fn()
      const predicate = (error: unknown): boolean => error instanceof CustomError

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: predicate, handle: handler })
        async doWork(): Promise<string> {
          throw new CustomError('matched by predicate')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        expect.any(CustomError),
        [],
      )
    })

    it('should re-throw errors when predicate returns false', async () => {
      const handler = jest.fn()
      const predicate = (error: unknown): boolean => error instanceof CustomError

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: predicate, handle: handler })
        async doWork(): Promise<string> {
          throw new AnotherError('not matched by predicate')
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow(AnotherError)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should pass method arguments to handler with predicate', async () => {
      const handler = jest.fn()
      const predicate = (): boolean => true

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: predicate, handle: handler })
        async doWork(_id: string, _count: number): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork('abc', 99)

      expect(handler).toHaveBeenCalledWith(
        expect.any(Error),
        ['abc', 99],
      )
    })

    it('should bind handler this context with predicate', async () => {
      let capturedThis: unknown = null
      const predicate = (): boolean => true

      class TestService {
        readonly logger = silentLogger
        readonly serviceName = 'PredicateService'

        @Catch({
          on: predicate,
          handle(this: TestService) {
            capturedThis = this
          },
        })
        async doWork(): Promise<string> {
          throw new Error('fail')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(capturedThis).toBe(service)
    })

    it('should work with stacked decorators mixing predicate and class-based on', async () => {
      const predicateHandler = jest.fn()
      const classHandler = jest.fn()
      const isCustomError = (error: unknown): boolean => error instanceof CustomError

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: AnotherError, handle: classHandler })
        @Catch({ on: isCustomError, handle: predicateHandler })
        async doWork(): Promise<string> {
          throw new CustomError('caught by predicate')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(predicateHandler).toHaveBeenCalledWith(
        expect.any(CustomError),
        [],
      )
      expect(classHandler).not.toHaveBeenCalled()
    })

    it('should propagate to outer decorator when predicate returns false', async () => {
      const predicateHandler = jest.fn()
      const catchAllHandler = jest.fn()
      const isCustomError = (error: unknown): boolean => error instanceof CustomError

      class TestService {
        readonly logger = silentLogger

        @Catch({ handle: catchAllHandler })
        @Catch({ on: isCustomError, handle: predicateHandler })
        async doWork(): Promise<string> {
          throw new AnotherError('not custom')
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(predicateHandler).not.toHaveBeenCalled()
      expect(catchAllHandler).toHaveBeenCalledWith(
        expect.any(AnotherError),
        [],
      )
    })

    it('should catch non-Error values when predicate matches them', async () => {
      const handler = jest.fn()
      const isStringError = (error: unknown): boolean => typeof error === 'string'

      class TestService {
        readonly logger = silentLogger

        @Catch({ on: isStringError, handle: handler })
        async doWork(): Promise<string> {
          // eslint-disable-next-line no-throw-literal -- testing non-Error throw
          throw 'string error'
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(handler).toHaveBeenCalledWith(
        'string error',
        [],
      )
    })
  })
})
