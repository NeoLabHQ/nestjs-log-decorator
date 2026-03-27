---
title: Remove requirement to define logger property on class to use decorator
---

## Initial User Prompt

remove requiremetn to set logger for class, in order to use decorator

### Context

Current implementation of Log decorator requires to implement `readonly logger = new Logger(YourClass.name)` in the class, and esentially implement Loggable interface in LogWrapper.ts.

### Requirements

#### Refactor

To simplify this implementation and future development, before implementing this task, firstly refactor this logger by extracting part of logic into new decorators. Create src/decorators folder with separate decorator per file:
    - EffectOnMethod decorator - it should receive following options {
            onInvoke?: (argsObject, targetObject, propertyKey, descriptor) => void, 
            afterReturn?: (argsObject, targetObject, propertyKey, result: R, descriptor) => R, 
            onError?: (argsObject, targetObject, propertyKey, error: Error, descriptor) => R, 
            finally?: (argsObject, targetObject, propertyKey, descriptor) => R
        }
        move applyToMethod logic there and rewrite, so it can be used as a decorator. (adjust interface if it's needed)
    - EffectOnClass decorator - move applyToClass logic there. It should support same interface as EffectOnMethod
    - Effect that support same interface as EffectOnMethod and EffectOnClass, but can be applied to method and class. Move Log decorator logic composition there.
    - Create SetMeta decorator that will be used to set metadata on target object, it should use setMeta function inside that allow to set metadata to descriptor. Add in this file also add getMeta function that allow to get metadata from descriptor (they both should accept symbol as a key)
    - Create OnInvokeHook, AfterReturnHook, OnErrorHook, FinallyHook decorators that inside should use Effect. They are not used directly right now, but will be used in future.
- Rebuild Log decorator based on Effect decorator.
- Rebuild NoLog decorator based on SetMetadata decorator.
- write tests for all new decorators and update existing tests
- CRITICAL: avoid any code dublication, all decorators together combines (including Log and NoLog) should reuse each other.
- write jsdoc for all decotars, keep old decorators jsdoc preserved.
- do not keep applyToMethod and applyToClass, even if it breaking change, it acceptable.
- src/decorators folder should be abstract and avoid any logger related logic and types, it can be used as a base for other decorators libraries.
- keep Log and NoLog decorator interface and usage as it now, only change internal logic.

#### Fix

in this example
```ts
import { Injectable, Logger } from '@nestjs/common';
import { Log, NoLog } from 'nestjs-log-decorator';

@Log()
@Injectable()
export class OrderService {
  readonly logger = new Logger(OrderService.name);

  constructor(
    readonly orderRepo: OrderRepository,
    readonly paymentGateway: PaymentGateway,
  ) {}

  // Logged with invocation + custom args (exclude sensitive card data)
  @Log({ 
    onInvoke: true, 
    args: (orderId: number, _cardDetails: CardDetails) => ({ orderId }) 
  })
  async processPayment(orderId: number, cardDetails: CardDetails) {
    const result = await this.paymentGateway.charge(orderId, cardDetails);
    return result;
  }
}
```

Logging will be done twice for processPayment, because both decorators wrap it. 

- Need add verification key per method in order to avoid double logging (or other fix). 
- Important to keep method decorator higher priority than class decorator. 
- Fix this directly in Effect, EffectOnClass, EffectOnMethod. So it will be easier to maintain and extend in future. 
- add tests for this scenario, in both Effect and Log decorators.


#### Feature

- Remove Loggable requirement, by directly injecting the logger property into target class during log decorator creation, if it not exists. By directly import from @nestjs/common.
- Injected logger should receive target class name as param.
- Remove LoggableConstructor in log decorator to allow any type of class to be decorated by Log decorator
- update tests and readme to reflect new changes.


## Description

// Will be filled in future stages by business analyst
