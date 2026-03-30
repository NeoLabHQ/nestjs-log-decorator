<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<div align="center">

<h1>NestJS Log Decorator</h1>

![Build Status](https://github.com/neolabhq/nestjs-log-decorator/actions/workflows/build.yaml/badge.svg)
[![npm version](https://img.shields.io/npm/v/nestjs-log-decorator)](https://www.npmjs.com/package/nestjs-log-decorator)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/nestjs-log-decorator)](https://www.npmjs.com/package/nestjs-log-decorator)
[![NPM Downloads](https://img.shields.io/npm/dw/nestjs-log-decorator)](https://www.npmjs.com/package/nestjs-log-decorator)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

TypeScript decorators that eliminate logging boilerplate from NestJS applications.

[Quick Start](#quick-start) •
[How It Works](#how-it-works) •
[Usage](#usage) •
[Options](#options) •
[API Reference](#api-reference) •
[Advanced Example](#advanced-example)

</div>

## Description

`@Log()` decorator replaces the try-catch logging pattern in NestJS service methods by automatically logging method success and errors, with optional invocation and result logging.

**Key Features**

- By default uses structured output
- Prettifies Axios errors
- Zero configuration
- Minimal dependencies
- Auto-injected logger (no need to define `logger` property)

## Installation

```bash
npm install nestjs-log-decorator @nestjs/common
```

## Quick Start

Simply apply `@Log()` to your class or method:

```typescript
import { Log } from 'nestjs-log-decorator';

class UserService {
  @Log()
  createUser(name: string, email: string) {
    return { id: 1, name, email };
  }
}
```

Once a service method is called, it will log the method invocation with all arguments.

```typescript
const result = service.createUser('John', 'john@example.com');
// console output:
// [UserService] { method: 'createUser', state: 'success', args: { name: 'John', email: 'john@example.com' } }
```

### Error Logging

If a method throws an error, by default the decorator logs and throws it, preserving the original stack trace.

```typescript
@Log()
createUser(name: string) {
  throw new Error('Validation failed');
}
```

Example call with error:

```typescript
const result = service.createUser('John');
// console output:
// [UserService] { method: 'createUser', state: 'error', args: { name: 'John' }, error: Error: Validation failed }
```

### Invocation Logging

If you want to log the method invocation, you can use the `onInvoke` option.

```typescript
@Log({ onInvoke: true })
async createUser(name: string) {
  return await Promise.resolve({ name });
}
```

Example call with invocation logging:

```typescript
const resultPromise = service.createUser('John');
// [UserService] { method: 'createUser', state: 'invoked', args: { name: 'John' } }
const result = await resultPromise;
// [UserService] { method: 'createUser', state: 'success', args: { name: 'John' } }
```

### Result Logging

If you want to include method results in success logs, use the `result` option.

```typescript
class UserService {
  // Logs result as-is
  @Log({ result: true })
  findUser(id: number) {
    return { id, name: 'John', email: 'john@example.com' };
  }

  // Logs formatted result
  @Log({
    result: (res: { id: number; name: string; email: string }) => ({ id: res.id, name: res.name }),
  })
  findPublicUser(id: number) {
    return { id, name: 'John', email: 'john@example.com' };
  }
}
```

Example success output:

```typescript
// [UserService] { method: 'findUser', state: 'success', args: { id: 1 }, result: { id: 1, name: 'John', email: 'john@example.com' } }
// [UserService] { method: 'findPublicUser', state: 'success', args: { id: 1 }, result: { id: 1, name: 'John' } }
```

### Complete Example

After installation, no additional configuration is needed. If the class has `logger` properly, the `@Log()` decorator will use it log method. If the logger is missing, the decorator will inject `@nestjs/common` Logger instance using the class name as the context.

```typescript
import { Log } from 'nestjs-log-decorator';

class PaymentService {

  @Log()
  async processPayment(amount: number, currency: string) {
    // Automatically logged on success or error
    return await this.gateway.processPayment(amount, currency);
  }

  async refund(transactionId: string) {
    // Not logged without @Log() decorator
    return await this.gateway.refund(transactionId);
  }
}
```

#### Explicit Logger (Optional)

If you need a custom logger (e.g., for testing or a different context), you can still define your own:

```typescript
import { Logger } from '@nestjs/common';
import { Log } from 'nestjs-log-decorator';

@Log()
class PaymentService {
  // Explicit logger takes precedence over auto-injected one
  readonly logger = new Logger('CustomPaymentContext');

  async processPayment(amount: number, currency: string) {
    // Logs using the explicit logger with 'CustomPaymentContext' context
    return await this.gateway.processPayment(amount, currency);
  }
}
```

## How It Works

The `@Log()` decorator wraps your methods with automatic try-catch logging. It extracts parameter names, captures arguments, and logs structured output on success or error.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @Log() Decorator Flow                            │
└─────────────────────────────────────────────────────────────────────────────┘

  Method Call
       │
       ▼
┌──────────────────┐
│ Extract Args     │  ──▶  { id: 1, name: 'John' }
│ (auto or custom) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐       ┌─────────────────────────────────────┐
│ onInvoke: true?  │──YES─▶│ logger.log({ state: 'invoked' })    │
└────────┬─────────┘       └─────────────────────────────────────┘
         │ NO
         ▼
┌──────────────────────┐
│ Execute Original     │
│ Method (sync/async)  │
└────────┬─────────────┘
         │
    ┌────┴────┐
    ▼         ▼
 SUCCESS    ERROR
    │         │
    ▼         ▼
┌────────┐ ┌──────────────────────────────────────────────────────┐
│log()   │ │ logger.error({ state: 'error', error: prettify(e) })│
│success │ │ (Axios errors auto-prettified)                      │
└────────┘ └──────────────────────────────────────────────────────┘
    │         │
    ▼         ▼
 Return    Re-throw
 Result    Error
```

## Usage

### Method-Level Decorator

Apply `@Log()` to specific methods for granular control:

```typescript
import { Log } from 'nestjs-log-decorator';

class DataService {
  @Log()
  async fetchData(id: number) {
    // This method is logged
    return await this.repository.findById(id);
  }

  helperMethod() {
    // This method is NOT logged
    return 'helper';
  }
}
```

### Class-Level Decorator

If you want to log all methods in a class, use the `@Log()` decorator on its definition:

```typescript
import { Log } from 'nestjs-log-decorator';

@Log()
@Injectable()
class PaymentService {
  processPayment(amount: number, currency: string) {
    // Automatically logged on success or error
    return { status: 'completed', amount, currency };
  }

  async refund(transactionId: string) {
    // Async methods are also logged
    return await this.gateway.refund(transactionId);
  }
}
```

#### Optional: Excluding Methods with `@NoLog()`

When using class-level `@Log()`, you can exclude specific methods with `@NoLog()`:

```typescript
import { Log, NoLog } from 'nestjs-log-decorator';

@Log()
class UserService {
  createUser(name: string) {
    // Logged
    return { name };
  }

  @NoLog()
  internalHelper() {
    // NOT logged
    return 'helper';
  }
}
```

## Options

### `onInvoke`

Log method invocation (before execution), not just completion:

```typescript
@Log({ onInvoke: true })
async fetchExternalData(url: string) {
  const response = await fetch(url);
  return response.json();
}
// Logs: { method: 'fetchExternalData', state: 'invoked', args: { url: '...' } }
// Logs: { method: 'fetchExternalData', state: 'success', args: { url: '...' } }
```

Class-level with `onInvoke`:

```typescript
@Log({ onInvoke: true })
class ApiService {
  // All methods will log invocation + completion
}
```

### `args` — Custom Argument Formatting

Control what arguments are logged. Useful for:

- Excluding large objects from logs
- Hiding sensitive data (passwords, tokens)
- Logging only specific arguments

```typescript
interface LargePayload {
  data: Buffer;
  metadata: object;
}

class SyncService {
  // Only log the ID, exclude the large payload
  @Log({ args: (id: number, _payload: LargePayload) => ({ id }) })
  async syncData(id: number, payload: LargePayload) {
    return await this.process(id, payload);
  }

  // Log multiple specific args
  @Log({ args: (userId: number, txId: string, _data: object) => ({ userId, txId }) })
  async processTransaction(userId: number, txId: string, data: object) {
    return await this.execute(userId, txId, data);
  }

  // Return a custom string
  @Log({ args: (id: number, name: string) => `${id}:${name}` })
  lookupUser(id: number, name: string) {
    return this.users.find(id, name);
  }
}
```

**Output:**

```
[SyncService] { method: 'syncData', state: 'success', args: { id: 123 } }
[SyncService] { method: 'processTransaction', state: 'success', args: { userId: 1, txId: 'tx_abc' } }
[SyncService] { method: 'lookupUser', state: 'success', args: '1:John' }
```

### `result` — Success Result Logging

Control how return values are included in success logs:

- `result: true` logs the raw return value
- `result: (value) => ...` logs a formatted value

```typescript
class PaymentService {
  // Log full return value
  @Log({ result: true })
  createPayment(id: number) {
    return { id, status: 'success', cardToken: 'tok_123' };
  }

  // Log only safe result fields
  @Log({
    result: (res: { id: number; status: string; cardToken: string }) => ({ id: res.id, status: res.status }),
  })
  createPaymentSafe(id: number) {
    return { id, status: 'success', cardToken: 'tok_123' };
  }
}
```

## Log Format

All logs are structured JSON objects:

### Success Log

```typescript
{
  method: 'methodName',
  state: 'success',
  args: { param1: value1, param2: value2 },
  // Present only when `result` option is configured
  result: { any: 'value' }
}
```

### Invocation Log (when `onInvoke: true`)

```typescript
{
  method: 'methodName',
  state: 'invoked',
  args: { param1: value1, param2: value2 }
}
```

### Error Log

```typescript
{
  method: 'methodName',
  state: 'error',
  args: { param1: value1, param2: value2 },
  error: Error | PrettifiedAxiosError
}
```

### Methods with No Arguments

```typescript
{
  method: 'methodName',
  state: 'success',
  args: undefined
}
```

## Error Handling

### Standard Errors

Regular JavaScript errors are logged as-is and re-thrown:

```typescript
@Log()
processPayment(amount: number) {
  if (amount <= 0) {
    throw new Error('Invalid amount');
  }
  return { status: 'success' };
}
```

**Log Output:**

```json
{
  method: 'processPayment',
  state: 'error',
  args: { amount: -10 },
  error: {
    message: 'Invalid amount',
    stack: '...',
    ...
  }
}
```

### Axios Errors (Auto-Prettified)

Axios errors are automatically formatted with structured request/response info:

```typescript
@Log()
async fetchData(url: string) {
  const response = await this.httpClient.get(url);
  return response.data;
}
```

**Prettified Axios Error Output:**

```typescript
{
  method: 'fetchData',
  state: 'error',
  args: { url: 'http://api.example.com/data' },
  error: {
    name: 'AxiosError',
    error: 'Request failed with status code 404',
    code: 'ERR_BAD_REQUEST',
    config: {
      method: 'get',
      url: 'http://api.example.com/data',
      headers: { ... },
    },
    response: {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Resource not found' },
      headers: { ... }
    }
  }
}
```

## API Reference

### `Log(options?)`

Decorator that can be applied to classes or methods. When applied to a class, by default all methods are logged.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onInvoke` | `boolean` | `false` | Log method invocation before execution |
| `args` | `(...args) => any` | `undefined` | Custom function to format logged arguments |
| `result` | `true \| (result) => any` | `undefined` | Include and optionally format successful method result |

### `NoLog()`

Method decorator that excludes a method from class-level `@Log()` logging.

### Exported Types

```typescript
import { Log, NoLog, LogOptions, Loggable, isLoggable } from 'nestjs-log-decorator';
```

| Export | Type | Description |
|--------|------|-------------|
| `Log` | Decorator | Main logging decorator |
| `NoLog` | Decorator | Exclude method from logging |
| `LogOptions` | Interface | Options for `@Log()` decorator |
| `Loggable` | Interface | Interface for classes with a `logger` property (optional) |
| `isLoggable` | Function | Type guard to check if instance has logger |

## Advanced Example

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Log, NoLog } from 'nestjs-log-decorator';

@Log()
@Injectable()
export class OrderService {
  // Optional: explicit logger takes precedence over auto-injected one
  readonly logger = new Logger(OrderService.name);

  constructor(
    readonly orderRepo: OrderRepository,
    readonly paymentGateway: PaymentGateway,
  ) {}

  // Logged with all args
  async createOrder(userId: number, items: OrderItem[]) {
    const order = await this.orderRepo.create({ userId, items });
    return order;
  }

  // Logged with invocation + custom args (exclude sensitive card data)
  @Log({
    onInvoke: true,
    args: (orderId: number, _cardDetails: CardDetails) => ({ orderId })
  })
  async processPayment(orderId: number, cardDetails: CardDetails) {
    const result = await this.paymentGateway.charge(orderId, cardDetails);
    return result;
  }

  // Not logged - internal helper
  @NoLog()
  calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // Logged - errors will include prettified Axios details if from HTTP call
  async syncWithExternalSystem(orderId: number) {
    const response = await this.externalApi.post('/orders', { orderId });
    return response.data;
  }
}
```
