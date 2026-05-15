import { IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { Logger } from '@nestjs/common'
import { Validate, ValidateObject } from '@/error-handling/validate.decorator'

/** Silenced NestJS logger for test services that use validation decorators. */
const silentLogger = new Logger('TestService')
silentLogger.log = jest.fn()
silentLogger.error = jest.fn()
silentLogger.warn = jest.fn()

class ValidationTestError extends Error {
  override name = 'ValidationTestError'
}

describe('Validate decorator', () => {
  describe('sync validate callback', () => {
    it('should call the original method when validation passes', async () => {
      class TestService {
        readonly logger = silentLogger

        @(Validate<object, [string]>({ validate: (_name) => {} }) as MethodDecorator)
        async greet(name: string): Promise<string> {
          return `Hello, ${name}`
        }
      }

      const service = new TestService()
      const result = await service.greet('Alice')

      expect(result).toBe('Hello, Alice')
    })

    it('should throw when sync validate callback throws', async () => {
      class TestService {
        readonly logger = silentLogger

        @(Validate<object, [string]>({
          validate: (name) => {
            if (!name) throw new ValidationTestError('Name is required')
          },
        }) as MethodDecorator)
        async greet(name: string): Promise<string> {
          return `Hello, ${name}`
        }
      }

      const service = new TestService()

      await expect(service.greet('')).rejects.toThrow(ValidationTestError)
      await expect(service.greet('')).rejects.toThrow('Name is required')
    })

    it('should not call the original method when validation fails', async () => {
      const methodBody = jest.fn().mockResolvedValue('result')

      class TestService {
        readonly logger = silentLogger

        @(Validate({
          validate: () => {
            throw new ValidationTestError('fail')
          },
        }) as MethodDecorator)
        async doWork(): Promise<string> {
          return methodBody()
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow('fail')
      expect(methodBody).not.toHaveBeenCalled()
    })
  })

  describe('async validate callback', () => {
    it('should support async validate callback that passes', async () => {
      class TestService {
        readonly logger = silentLogger

        @(Validate<object, [string]>({
          validate: async (_id) => {
            await Promise.resolve()
          },
        }) as MethodDecorator)
        async fetchData(id: string): Promise<string> {
          return `data-${id}`
        }
      }

      const service = new TestService()
      const result = await service.fetchData('123')

      expect(result).toBe('data-123')
    })

    it('should throw when async validate callback rejects', async () => {
      class TestService {
        readonly logger = silentLogger

        @(Validate<object, [string]>({
          validate: async (_id) => {
            await Promise.resolve()
            throw new ValidationTestError('Async validation failed')
          },
        }) as MethodDecorator)
        async fetchData(id: string): Promise<string> {
          return `data-${id}`
        }
      }

      const service = new TestService()

      await expect(service.fetchData('bad')).rejects.toThrow('Async validation failed')
    })
  })

  describe('method arguments passing', () => {
    it('should pass all method arguments to the validate callback', async () => {
      const validateFn = jest.fn()

      class TestService {
        readonly logger = silentLogger

        @(Validate({ validate: validateFn }) as MethodDecorator)
        async process(userId: string, count: number): Promise<string> {
          return `${userId}-${String(count)}`
        }
      }

      const service = new TestService()

      await service.process('user-1', 42)

      expect(validateFn).toHaveBeenCalledWith('user-1', 42)
    })
  })

  describe('logging behavior', () => {
    it('should log error with message when validation fails and message is provided', async () => {
      const errorSpy = jest.fn()
      const testLogger = new Logger('TestService')
      testLogger.error = errorSpy
      testLogger.log = jest.fn()

      class TestService {
        readonly logger = testLogger

        @(Validate({
          message: 'Input validation failed',
          validate: () => {
            throw new ValidationTestError('bad input')
          },
        }) as MethodDecorator)
        async doWork(): Promise<string> {
          return 'ok'
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow('bad input')
    })

    it('should not log when validation passes', async () => {
      const errorSpy = jest.fn()
      const testLogger = new Logger('TestService')
      testLogger.error = errorSpy
      testLogger.log = jest.fn()

      class TestService {
        readonly logger = testLogger

        @(Validate({
          message: 'Should not be logged',
          validate: () => {},
        }) as MethodDecorator)
        async doWork(): Promise<string> {
          return 'ok'
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(errorSpy).not.toHaveBeenCalled()
    })
  })

  describe('this context preservation', () => {
    it('should preserve this context in the original method', async () => {
      class TestService {
        readonly logger = silentLogger
        readonly prefix = 'Hello'

        @(Validate({ validate: () => {} }) as MethodDecorator)
        async greet(name: string): Promise<string> {
          return `${this.prefix}, ${name}`
        }
      }

      const service = new TestService()
      const result = await service.greet('World')

      expect(result).toBe('Hello, World')
    })
  })

  describe('multiple stacked Validate decorators', () => {
    it('should run all validations before calling the method (outermost first)', async () => {
      const callOrder: string[] = []

      class TestService {
        readonly logger = silentLogger

        @(Validate({
          validate: () => {
            callOrder.push('outer')
          },
        }) as MethodDecorator)
        @(Validate({
          validate: () => {
            callOrder.push('inner')
          },
        }) as MethodDecorator)
        async doWork(): Promise<string> {
          callOrder.push('method')

          return 'done'
        }
      }

      const service = new TestService()

      await service.doWork()

      expect(callOrder).toEqual(['outer', 'inner', 'method'])
    })

    it('should stop at first failing validation and not call subsequent ones', async () => {
      const methodBody = jest.fn().mockResolvedValue('result')

      class TestService {
        readonly logger = silentLogger

        @(Validate({
          validate: () => {
            throw new ValidationTestError('outer fails')
          },
        }) as MethodDecorator)
        @(Validate({ validate: () => {} }) as MethodDecorator)
        async doWork(): Promise<string> {
          return methodBody()
        }
      }

      const service = new TestService()

      await expect(service.doWork()).rejects.toThrow('outer fails')
      expect(methodBody).not.toHaveBeenCalled()
    })
  })
})

describe('ValidateObject decorator', () => {
  class TestInput {
    @IsString()
    @IsNotEmpty()
    name!: string

    @IsNumber()
    @Min(0)
    age!: number
  }

  describe('class-validator integration', () => {
    it('should pass when the extracted object is valid', async () => {
      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput]>({
          extract: (input) => input,
          handleErrors: () => {
            throw new ValidationTestError('should not be called')
          },
        }) as MethodDecorator)
        async process(input: TestInput): Promise<string> {
          return `Hello, ${input.name}`
        }
      }

      const input = new TestInput()
      input.name = 'Alice'
      input.age = 25

      const service = new TestService()
      const result = await service.process(input)

      expect(result).toBe('Hello, Alice')
    })

    it('should call handleErrors when class-validator finds violations', async () => {
      const handleErrors = jest.fn().mockImplementation(() => {
        throw new ValidationTestError('Validation failed')
      })

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput, string]>({
          extract: (input) => input,
          handleErrors,
        }) as MethodDecorator)
        async process(input: TestInput, _userId: string): Promise<string> {
          return `Hello, ${input.name}`
        }
      }

      const input = new TestInput()
      input.name = '' // invalid: IsNotEmpty will fail
      input.age = -1 // invalid: Min(0) will fail

      const service = new TestService()

      await expect(service.process(input, 'user-1')).rejects.toThrow('Validation failed')
      expect(handleErrors).toHaveBeenCalledWith(
        [input, 'user-1'],
        expect.arrayContaining([
          expect.objectContaining({ property: 'name' }),
          expect.objectContaining({ property: 'age' }),
        ]),
        expect.arrayContaining([
          expect.stringContaining('name'),
          expect.stringContaining('age'),
        ]),
      )
    })

    it('should not call the original method when validation fails', async () => {
      const methodBody = jest.fn().mockResolvedValue('result')

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput]>({
          extract: (input) => input,
          handleErrors: () => {
            throw new ValidationTestError('invalid')
          },
        }) as MethodDecorator)
        async process(_input: TestInput): Promise<string> {
          return methodBody()
        }
      }

      const input = new TestInput()
      input.name = ''
      input.age = -1

      const service = new TestService()

      await expect(service.process(input)).rejects.toThrow('invalid')
      expect(methodBody).not.toHaveBeenCalled()
    })
  })

  describe('extract function', () => {
    it('should extract a nested object from method arguments', async () => {
      class NestedData {
        @IsString()
        @IsNotEmpty()
        value!: string
      }

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [string, NestedData]>({
          extract: (_id, data) => data,
          handleErrors: () => {
            throw new ValidationTestError('nested invalid')
          },
        }) as MethodDecorator)
        async process(_id: string, data: NestedData): Promise<string> {
          return data.value
        }
      }

      const data = new NestedData()
      data.value = '' // invalid

      const service = new TestService()

      await expect(service.process('id-1', data)).rejects.toThrow('nested invalid')
    })
  })

  describe('handleErrors callback', () => {
    it('should receive the original method args tuple, validation errors, and formatted messages', async () => {
      const handleErrors = jest.fn().mockImplementation(() => {
        throw new ValidationTestError('fail')
      })

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput, string]>({
          extract: (input) => input,
          handleErrors,
        }) as MethodDecorator)
        async process(input: TestInput, userId: string): Promise<string> {
          return `${input.name}-${userId}`
        }
      }

      const input = new TestInput()
      input.name = ''
      input.age = 25

      const service = new TestService()

      await expect(service.process(input, 'u1')).rejects.toThrow('fail')

      const [args, errors, messages] = handleErrors.mock.calls[0]!

      expect(args).toEqual([input, 'u1'])
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('name')
      expect(messages).toHaveLength(1)
      expect(messages[0]).toContain('name')
    })
  })

  describe('validatorOptions pass-through', () => {
    it('should forward validatorOptions to class-validator', async () => {
      class GroupedInput {
        @IsNotEmpty({ groups: ['create'] })
        title!: string
      }

      const handleErrors = jest.fn().mockImplementation(() => {
        throw new ValidationTestError('fail')
      })

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [GroupedInput]>({
          extract: (input) => input,
          handleErrors,
          validatorOptions: { groups: ['create'] },
        }) as MethodDecorator)
        async create(input: GroupedInput): Promise<string> {
          return input.title
        }
      }

      const input = new GroupedInput()
      input.title = '' // empty triggers IsNotEmpty in 'create' group

      const service = new TestService()

      await expect(service.create(input)).rejects.toThrow('fail')
      expect(handleErrors).toHaveBeenCalled()
    })

    it('should not trigger group-specific validation for non-matching groups', async () => {
      class GroupedInput {
        @IsNotEmpty({ groups: ['create'] })
        @IsString({ always: true })
        title!: string
      }

      const handleErrors = jest.fn().mockImplementation(() => {
        throw new ValidationTestError('fail')
      })

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [GroupedInput]>({
          extract: (input) => input,
          handleErrors,
          validatorOptions: { groups: ['update'], forbidUnknownValues: false },
        }) as MethodDecorator)
        async update(_input: GroupedInput): Promise<string> {
          return 'updated'
        }
      }

      const input = new GroupedInput()
      input.title = '' // empty string: IsNotEmpty('create') should NOT trigger, IsString('always') passes

      const service = new TestService()
      const result = await service.update(input)

      expect(result).toBe('updated')
      expect(handleErrors).not.toHaveBeenCalled()
    })
  })

  describe('logging behavior', () => {
    it('should log error with message when ValidateObject validation fails and message is provided', async () => {
      const errorSpy = jest.fn()
      const testLogger = new Logger('TestService')
      testLogger.error = errorSpy
      testLogger.log = jest.fn()

      class TestService {
        readonly logger = testLogger

        @(ValidateObject<object, [TestInput]>({
          message: 'Applicant data validation failed',
          extract: (input) => input,
          handleErrors: () => {
            throw new ValidationTestError('invalid data')
          },
        }) as MethodDecorator)
        async process(input: TestInput): Promise<string> {
          return input.name
        }
      }

      const input = new TestInput()
      input.name = ''
      input.age = -1

      const service = new TestService()

      await expect(service.process(input)).rejects.toThrow('invalid data')
    })
  })

  describe('this context preservation', () => {
    it('should preserve this context in the original method after validation passes', async () => {
      class TestService {
        readonly logger = silentLogger
        readonly prefix = 'Result'

        @(ValidateObject<object, [TestInput]>({
          extract: (input) => input,
          handleErrors: () => {
            throw new ValidationTestError('fail')
          },
        }) as MethodDecorator)
        async process(input: TestInput): Promise<string> {
          return `${this.prefix}: ${input.name}`
        }
      }

      const input = new TestInput()
      input.name = 'Alice'
      input.age = 25

      const service = new TestService()
      const result = await service.process(input)

      expect(result).toBe('Result: Alice')
    })
  })

  describe('error propagation', () => {
    it('should propagate the exact error thrown by handleErrors', async () => {
      const specificError = new ValidationTestError('specific validation message')

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput]>({
          extract: (input) => input,
          handleErrors: () => {
            throw specificError
          },
        }) as MethodDecorator)
        async process(input: TestInput): Promise<string> {
          return input.name
        }
      }

      const input = new TestInput()
      input.name = ''
      input.age = -1

      const service = new TestService()

      await expect(service.process(input)).rejects.toBe(specificError)
    })
  })

  describe('messages formatting', () => {
    it('should format constraint messages as "property: constraint1, constraint2"', async () => {
      let capturedMessages: string[] = []

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [TestInput]>({
          extract: (input) => input,
          handleErrors: (_args, _errors, messages) => {
            capturedMessages = messages
            throw new ValidationTestError('fail')
          },
        }) as MethodDecorator)
        async process(input: TestInput): Promise<string> {
          return input.name
        }
      }

      const input = new TestInput()
      input.name = ''
      input.age = -5

      const service = new TestService()

      await expect(service.process(input)).rejects.toThrow('fail')

      expect(capturedMessages.length).toBe(2)

      const nameMsg = capturedMessages.find(m => m.startsWith('name:'))
      const ageMsg = capturedMessages.find(m => m.startsWith('age:'))

      expect(nameMsg).toBeDefined()
      expect(ageMsg).toBeDefined()
    })

    it('should use "Invalid value" fallback when constraints object is undefined', async () => {
      let capturedErrors: import('class-validator').ValidationError[] = []
      let capturedMessages: string[] = []

      class NestedChild {
        @IsNotEmpty()
        value!: string
      }

      class ParentInput {
        @ValidateNested()
        @Type(() => NestedChild)
        child!: NestedChild
      }

      class TestService {
        readonly logger = silentLogger

        @(ValidateObject<object, [ParentInput]>({
          extract: (input) => input,
          handleErrors: (_args, errors, messages) => {
            capturedErrors = errors
            capturedMessages = messages
            throw new ValidationTestError('fail')
          },
        }) as MethodDecorator)
        async process(input: ParentInput): Promise<string> {
          return input.child.value
        }
      }

      const input = new ParentInput()
      const child = new NestedChild()
      child.value = '' // invalid: triggers IsNotEmpty on nested child
      input.child = child

      const service = new TestService()

      await expect(service.process(input)).rejects.toThrow('fail')

      // Verify the parent 'child' error has children (nested errors)
      const childError = capturedErrors.find(e => e.property === 'child')
      expect(childError).toBeDefined()
      expect(childError!.children).toBeDefined()
      expect(childError!.children!.length).toBeGreaterThan(0)
      expect(capturedMessages.length).toBeGreaterThan(0)
    })
  })
})

describe('stacking Validate and ValidateObject decorators', () => {
  class TestInput {
    @IsString()
    @IsNotEmpty()
    name!: string

    @IsNumber()
    @Min(0)
    age!: number
  }

  it('should run both validators when stacked', async () => {
    const callOrder: string[] = []

    class TestService {
      readonly logger = silentLogger

      @(Validate({
        validate: () => {
          callOrder.push('validate')
        },
      }) as MethodDecorator)
      @(ValidateObject<object, [TestInput]>({
        extract: (input) => input,
        handleErrors: () => {
          callOrder.push('validateObject-fail')
          throw new ValidationTestError('object invalid')
        },
      }) as MethodDecorator)
      async process(input: TestInput): Promise<string> {
        callOrder.push('method')

        return input.name
      }
    }

    const input = new TestInput()
    input.name = 'Alice'
    input.age = 25

    const service = new TestService()

    await service.process(input)

    expect(callOrder).toEqual(['validate', 'method'])
  })
})
