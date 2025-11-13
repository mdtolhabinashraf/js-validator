# Usage & Extended Examples — js-validator

This file provides a compact, copy-pasteable set of examples covering all
features exported by the library: the `v` validator factory, `createSchema`,
primitive validators (string/number/boolean/email), `object` and `array`
combinators, error shapes, and both `safeParse` and `parse` usage.

Prefer `safeParse` for programmatic error handling and `parse` when you want
exceptions for invalid inputs (e.g. in tests or small scripts).

## Navigator

Jump to any of the sections below:

- [Quick reference — exports](#quick-reference-exports)
- [TypeScript: using a schema as a type (user-friendly)](#typescript-using-schema-as-type)
- [Error shape](#error-shape)
- [1) Basic validators — string, number, boolean, email](#basic-validators)
- [2) Optional, nullable, message, refine](#optional-nullable-message-refine)
- [3) Object schemas and `createSchema`](#object-schemas-create-schema)
- [4) Arrays](#arrays)
- [5) safeParse vs parse](#safeparse-vs-parse)
- [6) Composing and reusing validators](#composing-and-reusing-validators)
- [7) Example: full feature form flow (browser)](#example-form-flow)
- [8) Error formatting helpers (example)](#error-formatting-helpers)
- [Error messages and precedence (clear rules)](#error-messages-precedence)
- [9) Tips and edge-cases](#tips-edge-cases)
- [10) Summary cheat-sheet](#summary-cheat-sheet)

<a id="quick-reference-exports"></a>

## Quick reference — exports

- `v` — the validator factory namespace (factories are callables: `v.string()`,
  `v.email()`, `v.number()`, `v.boolean()`, `v.object(schema)`, `v.array(item)`)
- `createSchema(schema)` — lower-level helper that builds a schema validator
  (useful if you want a separate factory without the `v` namespace)

All factories return chainable validators that expose: `.min()`, `.max()`,
`.regex()`, `.optional()`, `.nullable()`, `.message()`, and `.refine()` (where
applicable). In examples below you'll see both chaining forms and call-then-chain
forms. Avoid using the bare symbols like `v.string` without parentheses.

<a id="typescript-using-schema-as-type"></a>

## TypeScript: using a schema as a type (user-friendly)

The runtime schema you build with `v.object(...)` describes the validated data
shape and can also be used as a TypeScript type. There are two common patterns:

- Provide the explicit TypeScript type to `v.object<T>()` (recommended when you
  already have a type or want the compiler to check the runtime schema against
  your type):

```ts
type User = { id: string; email: string; age?: number };

const userSchema = v.object<User>({
  id: v.string().min(3),
  email: v.email(),
  age: v.number().optional(),
});

// On success, `res.data` will be typed as `User`.
const res = userSchema.safeParse({ id: "u1", email: "a@b.com" });
if (res.success) {
  // res.data is a `User` here
  const u: User = res.data;
}
```

- Infer the type from an existing schema using a small helper type (useful when
  you built the schema without the generic):

```ts
import v from "@mdtolhabinashraf/js-validator";

const userSchema = v.object({ id: v.string().min(3), email: v.email() });
type UserFromSchema = v.infer<typeof userSchema>; // inferred type

// Note: `ReturnType<typeof userSchema>` is not ideal because the callable
// signature returns `T | null` when called as a function. Prefer the
// use `v.infer` helper or provide the generic to `v.object<T>()`.
```

Recommendation: prefer `v.object<T>()` when you already know the desired TypeScript
shape — it gives an extra compile-time check that your runtime validators match
the declared type.

<a id="error-shape"></a>

## Error shape

`safeParse` returns either `{ success: true, data }` or
`{ success: false, errors }` where `errors` is a plain `Record<string, string>`
mapping a path to a message. Paths use dot notation for objects and bracket
notation for array indexes (e.g. `user.email`, `items[0]`, `items[2].owner.email`).

Example error result:

```ts
{
  success: false,
  errors: {
    "name": "Must be at least 2 characters",
    "items[1].price": "Must be at least 0",
  }
}
```

<a id="basic-validators"></a>

## 1) Basic validators — string, number, boolean, email

String validators

```ts
import v from "@mdtolhabinashraf/js-validator";

// create a reusable validator
const shortText = v.string().min(2, "Too short").max(30);

shortText.safeParse("A"); // { success: false, errors: { _root: 'Too short' } }
shortText.safeParse("Alice"); // { success: true, data: 'Alice' }
```

Number validators

```ts
const positiveInt = v.number().min(0, "Must be >= 0");
positiveInt.safeParse(-1); // fail
positiveInt.safeParse(10); // ok
```

Boolean validators

```ts
const mustBeTrue = v.boolean().refine((b) => b === true, "Must be true");
mustBeTrue.safeParse(false); // fail
mustBeTrue.safeParse(true); // ok
```

Email (preconfigured string)

```ts
const email = v.email();
email.safeParse("nope"); // fail with 'Invalid email address'
email.safeParse("user@example.com"); // ok
```

Notes on forms:

- `v.string()` — call the factory, then chain: `v.string().min(2)`
- `v.string.min(2)` — chain form (also valid if you prefer)

<a id="optional-nullable-message-refine"></a>

## 2) Optional, nullable, message, refine

These helpers are available on all primitives and keep validations small and composable.

```ts
const maybeName = v.string().optional(); // allows undefined
const nullableAge = v.number().nullable(); // allows explicit null

const id = v
  .string()
  .refine((s) => /^[a-z0-9_-]{3,}$/.test(s), "Invalid id")
  .message("Invalid identifier");

id.safeParse("x"); // fail -> message from refine or message()
```

`.refine(predicate, message)` appends a custom rule. The first failing rule's
message is used when reporting errors.

Important: `.nullable()` does NOT make a field optional.

- `v.x().nullable()` — allows the value to be `null`, but the field must still be present (not `undefined`).
- `v.x().optional()` — allows the field to be omitted (`undefined`).

If you want to allow both `null` and `undefined`, combine them explicitly:

```ts
const maybeNullOrMissing = v.string().nullable().optional();

// Equivalent to: value may be a string, null, or undefined (field omitted)
```

Examples showing behavior:

```ts
const s1 = v.string().nullable();
s1.safeParse(undefined); // ❌ fails: field missing
s1.safeParse(null); // ✅ ok (explicit null allowed)

const s2 = v.string().nullable().optional();
s2.safeParse(undefined); // ✅ ok (optional)
s2.safeParse(null); // ✅ ok (nullable)
s2.safeParse("x"); // ✅ ok (string)
```

This distinction is intentional: `.nullable()` controls whether `null` is accepted
as a value, while `.optional()` controls whether the property may be omitted.
Combine them when both behaviors are desired.

<a id="object-schemas-create-schema"></a>

## 3) Object schemas and `createSchema`

Use `v.object(schema)` to build nested schemas. `createSchema(schema)` does the
same but is exported for lower-level usage.

```ts
import v, { createSchema } from "@mdtolhabinashraf/js-validator";

// Using v.object (top-level schema)
const userSchema = v.object({
  id: v.string().min(3),
  email: v.email(),
  age: v.number().optional(),
});

// Using createSchema directly (same result shape)
const userSchema2 = createSchema({
  id: v.string().min(3),
  email: v.email(),
});

userSchema.safeParse({ id: "u1", email: "x" });
// -> { success: false, errors: { email: 'Invalid email address' } }
```

You can nest objects arbitrarily. When nested validators fail, the top-level
`safeParse` `errors` object will contain **joined** paths (`profile.bio`,
`items[2].owner.email`, etc.).

<a id="arrays"></a>

## 4) Arrays

Arrays are declared with `v.array(itemValidator)`. Item-level errors use
bracket-index paths.

```ts
const tagsSchema = v.array(v.string().min(1)).min(1);

tagsSchema.safeParse([]);
// -> { success: false, errors: { _root: 'Must contain at least 1 items' } }

tagsSchema.safeParse(["ok", ""]);
// -> { success: false, errors: { "[1]": "Must be at least 1 characters" } }
```

You can combine arrays and objects freely:

```ts
const productSchema = v.object({
  id: v.string().min(1),
  tags: v.array(v.string().min(2)).optional(),
});
```

<a id="safeparse-vs-parse"></a>

## 5) safeParse vs parse

Prefer `safeParse` when your program should handle validation errors without
throwing. `parse` will throw an `Error` containing a combined message when
validation fails (useful in tests or CLI scripts).

```ts
const schema = v.object({ name: v.string().min(2) });

// safeParse (non-throwing)
const r = schema.safeParse({ name: "A" });
if (!r.success) {
  // r.errors is a record of path -> message
  console.log(r.errors);
}

// parse (throws on invalid)
try {
  schema.parse({ name: "A" });
} catch (err: any) {
  console.error(err.message); // Validation Error: name: Must be at least 2 characters
}
```

<a id="composing-and-reusing-validators"></a>

## 6) Composing and reusing validators

Create small validators for reuse and clarity.

```ts
const id = v
  .string()
  .min(3)
  .refine((s) => /^[a-z]/.test(s), "Must start with a letter");
const email = v.email();

const user = v.object({ id, email, label: v.string().optional() });

user.safeParse({ id: "1abc", email: "bad" });
// -> errors: { id: 'Must start with a letter', email: 'Invalid email address' }
```

<a id="example-form-flow"></a>

## 7) Example: full feature form flow (browser)

```ts
import v from "@mdtolhabinashraf/js-validator";

const registerSchema = v.object({
  name: v.string().min(2, "Name is too short"),
  email: v.email(),
  password: v
    .string()
    .min(8, "Password too short")
    .refine((s) => /[A-Z]/.test(s), "Must contain an uppercase letter")
    .refine((s) => /\d/.test(s), "Must contain a number"),
});

function handleSubmit(values: unknown) {
  const res = registerSchema.safeParse(values);
  if (!res.success) {
    // map res.errors to form fields
    showFormErrors(res.errors);
    return;
  }
  // safe to call server with res.data
  api.register(res.data);
}
```

<a id="error-formatting-helpers"></a>

## 8) Error formatting helpers (example)

Convert the `errors` record to an array for UI lists or to a nested object
for frameworks that prefer nested error shapes.

```ts
function errorsToArray(errors: Record<string, string>) {
  return Object.entries(errors).map(([path, message]) => ({ path, message }));
}

function errorsToNested(errors: Record<string, string>) {
  const out: any = {};
  for (const [k, v] of Object.entries(errors)) {
    // naive dot/bracket split — adapt to your needs
    out[k] = v;
  }
  return out;
}
```

<a id="error-messages-precedence"></a>

## Error messages and precedence (clear rules)

The library supports per-rule messages and a `.message()` fallback on validators.
Understanding precedence helps you control which message appears to end users.

Priority (highest → lowest):

1. Rule-specific message (e.g. `.min(3, 'Too short')` or `.refine(fn, 'Bad')`)
2. Validator-level `.message('Fallback')` value
3. Default built-in messages (e.g. `Required field is missing`, `Expected string`)

How it works (implementation summary): when a rule fails, the validator will
use the rule's message if provided. If the rule has no message, it will use the
validator's `.message()` value (if set). Otherwise it falls back to a sensible
default message for that failure mode.

Examples:

```ts
const v1 = v.string().min(3, "Too short").message("Fallback");
v1.safeParse("x"); // -> 'Too short' (rule-specific takes priority)

const v2 = v.string().min(3).message("Fallback message");
v2.safeParse("x"); // -> 'Fallback message' (no rule message)

const v3 = v.string().min(3);
v3.safeParse("x"); // -> default message: 'Must be at least 3 characters'
```

Note: `.message()` is a validator-level fallback — it does not override a
more specific rule message provided at the rule call site.

<a id="tips-edge-cases"></a>

## 9) Tips and edge-cases

- Use `.optional()` to allow omission (undefined) and `.nullable()` to allow
  explicit `null` values.
- Prefer rule-specific messages for UX (`.min(3, "Name too short")`).
- For async checks (e.g. DB uniqueness), run them after `safeParse` and add
  errors from your async layer; built-in validators are synchronous.

<a id="summary-cheat-sheet"></a>

## 10) Summary cheat-sheet

- `v.string()` / `v.string.min(2)` — string validators
- `v.number()` — number validators with `.min()`/`.max()`
- `v.boolean()` — boolean validators
- `v.email()` — email validator
- `v.object(schema)` — compose object schemas
- `v.array(item)` — array of items (indexed errors)
- `createSchema(schema)` — lower-level schema factory
- `.optional()`, `.nullable()`, `.message()`, `.refine()` — modifiers
- `safeParse(data)` — returns `{ success, data/errors }`
- `parse(data)` — returns data or throws on validation error
