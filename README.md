# js-validator

![npm version](https://img.shields.io/npm/v/@mdtolhabinashraf/js-validator.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

> A small, zero-dependency, type-safe JavaScript validation utility with clear
> path-aware error reporting and friendly TypeScript typings.

<!-- NAVIGATOR / TABLE OF CONTENTS -->

## Navigator

- [About](#about)
- [Install](#install)
- [Quickstart](#quickstart)
- [Usage](#usage)
- [Features](#features)
- [Examples](#examples)
  - [Basic object validation](#basic-object-validation)
  - [Nested objects and arrays](#nested-objects-and-arrays)
  - [Optional / nullable fields](#optional--nullable-fields)
  - [Custom rules (refine) and messages](#custom-rules-refine-and-messages)
  - [Safe parsing vs parse (throwing)](#safe-parsing-vs-parse-throwing)
- [API Reference](#api-reference)
- [TypeScript usage](#typescript-usage)
- [Contribution, License & Support](#contribution-license--support)
- [FAQ](#faq)

## About

`js-validator` is a lightweight validation library focused on strong TypeScript
types, simple chainable validators, and readable error messages keyed by path
(e.g. `user.email` or `items[2]`). It's dependency-free and designed for use
in both browser and Node.js environments.

Package: `@mdtolhabinashraf/js-validator`

Author: [Md. Tolha Bin Ashraf](https://github.com/mdtolhabinashraf)

License: [MIT](LICENSE)

## Install

Install from npm:

```bash
npm install @mdtolhabinashraf/js-validator
```

Or with yarn:

```bash
yarn add @mdtolhabinashraf/js-validator
```

## Quickstart

ES Module import (TypeScript / modern Node):

```ts
import v from "@mdtolhabinashraf/js-validator";

const userSchema = v.object({
  name: v.string.min(2),
  email: v.email(),
  age: v.number.optional(),
});

const result = userSchema.safeParse({ name: "Amy", email: "amy@example.com" });
if (result.success) console.log("Valid:", result.data);
else console.error("Errors:", result.errors);
```

CommonJS (if your bundler or runtime uses CJS):

```js
const v = require("@mdtolhabinashraf/js-validator");
// same API as above
```

## Usage

For extended examples, real-world patterns, and a compact quick-reference, see the dedicated Usage guide: [USAGE.md](USAGE.md).

## Features

- Zero dependencies, small footprint
- Friendly TypeScript types and autocomplete
- Chainable validators with common helpers: `.min()`, `.max()`, `.regex()`
- Built-in `v.email()` and primitive factories: `v.string()`, `v.number()`, `v.boolean()`
- Composite `v.object(schema)` and `v.array(itemValidator)` support
- Path-aware error collection (keys like `user.email` or `[1]` for arrays)
- `safeParse` for non-throwing validation result objects and `parse` for throwing
- Support for `.optional()`, `.nullable()`, custom `.refine()` rules and `.message()` overrides

## Examples

The library exposes a compact but expressive API. Below are common usage patterns.

For extended examples and real-world usage patterns, see [USAGE.md](USAGE.md).

### Basic object validation

```ts
import v from "@mdtolhabinashraf/js-validator";

const personSchema = v.object({
  name: v.string.min(2),
  email: v.email(),
  active: v.boolean.optional(),
});

const r = personSchema.safeParse({ name: "J", email: "nope" });
// r.success === false
// r.errors might be: { name: 'Must be at least 2 characters', email: 'Invalid email address' }
```

### Nested objects and arrays

```ts
const productSchema = v.object({
  id: v.string(),
  title: v.string.min(1),
  tags: v.array(v.string.min(1)).optional(),
  owner: v.object({
    id: v.string(),
    email: v.email(),
  }),
});

const r = productSchema.safeParse({
  id: "p1",
  title: "Nice",
  tags: ["good", ""],
  owner: { id: "u1", email: "bad-email" },
});

// Errors will include paths such as:
// { "tags[1]": "Must be at least 1 character", "owner.email": "Invalid email address" }
```

### Optional & nullable fields

Use `.optional()` to allow `undefined` (omit field) and `.nullable()` to allow `null`.

```ts
const schema = v.object({
  nickname: v.string.optional(), // missing field is valid
  middleName: v.string.nullable(), // explicit `null` is valid
});

schema.safeParse({}); // ok
schema.safeParse({ middleName: null }); // ok
```

### Custom rules (`refine`) and messages

Attach small custom checks using `.refine(predicate, message)` or override messages with `.message()`:

```ts
const strongPassword = v.string
  .min(8, "Password too short")
  .refine((s) => /[A-Z]/.test(s), "Must contain an uppercase letter")
  .refine((s) => /\d/.test(s), "Must contain a number");

const r = strongPassword.safeParse("weak");
// errors: { _root: 'Password too short' } (or the first failing message depending on context)
```

### Safe parsing vs parse (throwing)

Use `safeParse` when you want a result object with `success` and `errors`:

```ts
const res = schema.safeParse(someData);
if (!res.success) console.log(res.errors);
```

Use `parse` when you prefer exceptions on invalid input (good for short scripts/tests):

```ts
try {
  const valid = schema.parse(someData);
  // use valid
} catch (err) {
  console.error(err.message);
}
```

## API Reference

Top-level exports:

- `v` — factory namespace

  - `v.string()` — build string validators; chain `.min(n)`, `.max(n)`, `.regex(re)`, `.optional()`, `.nullable()`, `.message(msg)`, `.refine(fn, msg)`
  - `v.email()` — preconfigured email validator (same chaining helpers)
  - `v.number()` — numeric validators with `.min(n)` and `.max(n)`
  - `v.boolean()` — boolean validator
  - `v.object(schema)` — create an object schema validator (returns a callable with `.safeParse()` and `.parse()`)
  - `v.array(itemValidator)` — array validator for lists of items

- `createSchema(schema)` — lower-level factory used internally; returns a callable with `.safeParse()` and `.parse()` as well

Types and results:

- `safeParse(data)` returns `{ success: true; data }` or `{ success: false; errors }` where `errors` is a record of path → message
- `parse(data)` returns the validated value or throws `Error` with combined messages

## TypeScript usage

Types are exported and inferred. Use `v.object<YourType>({...})` when you want to ensure the runtime schema aligns with a static TypeScript type.

```ts
type User = { name: string; email: string; age?: number };

const userSchema = v.object<User>({
  name: v.string.min(2),
  email: v.email(),
  age: v.number.optional(),
});

// userSchema.safeParse(...) will produce `data` matching `User` on success
```

## Contribution, License & Support

Contributions welcome — please open issues or pull requests at the project's
[GitHub repository](https://github.com/mdtolhabinashraf/js-validator).

Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for detailed guidelines.

For detailed usage examples and extended guides, please also see the
[Usage guide](USAGE.md).

This project is released under the MIT license. See the `LICENSE` file for
details.

## FAQ

Q: Is the library synchronous or asynchronous?

A: js-validator's built-in validators are synchronous. The library does not
include async validators by default (no network or DB checks). For async
validation you can run custom `.refine` predicates that call async helpers,
but you'll need to orchestrate that externally (for example, run async checks
after successful `safeParse`).

Q: How are error paths formatted?

A: Errors use dot notation for object properties and bracket notation for array
indexes. Examples: `user.email`, `items[0]`, `items[2].owner.email`.

## Changelog / Versions

See the repository releases and the `package.json` `version` field.
