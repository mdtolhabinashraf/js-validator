/**
 * js-validator — a small, zero-dependency, type-safe validation utility.
 *
 * Design goals:
 * - Minimal and dependency-free so it is safe to publish as a small package.
 * - Friendly TypeScript typings for excellent editor autocompletion.
 * - Clear, path-aware error reporting for nested objects and arrays.
 *
 * Author: Md. Tolha Bin Ashraf
 * License: MIT
 */

// --- Type Definitions ---

/**
 * Context passed to validators for error collection and path tracking.
 * @internal
 */
type ValidationContext = {
  path: string;
  errors: Record<string, string>;
};

/**
 * A function that validates a single field.
 *
 * @template T The expected type of the validated value.
 * @param value The value to validate.
 * @param ctx Optional context to collect error messages with a path.
 * @returns The validated value, or `undefined` if validation fails.
 */
export type FieldValidator<T> = {
  (value: unknown, ctx?: ValidationContext): T | undefined;
  /**
   * Marks the field as optional. If the input value is `undefined`, validation will pass.
   * @returns A new validator that allows `undefined`.
   */
  optional: () => FieldValidator<T | undefined>;
  /**
   * Marks the field as nullable. If the input value is `null`, validation will pass.
   * @returns A new validator that allows `null`.
   */
  nullable: () => FieldValidator<T | null>;
  /**
   * Provides a fallback error message for this validator.
   *
   * @remarks
   * - If a more specific message (e.g., from `v.string().min(5, "Too short")`) is already set,
   *   this fallback will not override it.
   * - Prefer rule-specific messages for better error reporting.
   *
   * @param msg The error message.
   * @returns A new validator with the fallback message.
   */
  message: (msg: string) => FieldValidator<T>;
  /**
   * Adds a custom validation rule.
   *
   * @param predicate A function that returns `true` if the value is valid.
   * @param msg An optional error message if the predicate fails.
   * @returns A new validator with the custom rule.
   */
  refine: (predicate: (value: T) => boolean, msg?: string) => FieldValidator<T>;
};

/**
 * A `FieldValidator` with additional methods for string validation.
 */
export type StringFieldValidator = FieldValidator<string> & {
  /**
   * Validates the string against a regular expression.
   *
   * @param pattern The regular expression to test against.
   * @param msg An optional error message.
   * @returns A new string validator.
   */
  regex: (pattern: RegExp, msg?: string) => StringFieldValidator;
  /**
   * Sets a minimum length for the string.
   *
   * @param n The minimum length.
   * @param msg An optional error message.
   * @returns A new string validator.
   */
  min: (n: number, msg?: string) => StringFieldValidator;
  /**
   * Sets a maximum length for the string.
   *
   * @param n The maximum length.
   * @param msg An optional error message.
   * @returns A new string validator.
   */
  max: (n: number, msg?: string) => StringFieldValidator;
};

/**
 * A `FieldValidator` for arrays with item-count rules.
 */
export type ArrayFieldValidator<T> = FieldValidator<T[]> & {
  min: (n: number, msg?: string) => ArrayFieldValidator<T>;
  max: (n: number, msg?: string) => ArrayFieldValidator<T>;
};

/**
 * A `FieldValidator` with additional methods for number validation.
 */
export type NumberFieldValidator = FieldValidator<number> & {
  /**
   * Sets a minimum value for the number.
   *
   * @param n The minimum value.
   * @param msg An optional error message.
   * @returns A new number validator.
   */
  min: (n: number, msg?: string) => NumberFieldValidator;
  /**
   * Sets a maximum value for the number.
   *
   * @param n The maximum value.
   * @param msg An optional error message.
   * @returns A new number validator.
   */
  max: (n: number, msg?: string) => NumberFieldValidator;
};

/**
 * Describes the schema for validating an object.
 * Each key corresponds to a property in the target object, and the value
 * defines the validation rule for that property.
 *
 * @template T The type of the object to validate.
 */
export type ValidationSchema<T> = {
  [K in keyof T]: FieldValidator<T[K]>;
};

/**
 * Represents a successful validation result.
 */
export type SafeParseSuccess<T> = { success: true; data: T };
/**
 * Represents a failed validation result.
 */
export type SafeParseFailure = {
  success: false;
  errors: Record<string, string>;
};

/**
 * The result of a `safeParse` operation.
 */
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
  public errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    const message = Object.entries(errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    super(`[ERR_VALIDATION]: ${message}`);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

/**
 * A function that validates an object against a schema.
 *
 * @template T The expected output type.
 */
export type SchemaValidator<T> = ((data: unknown) => T | null) & {
  /**
   * Validates the input and returns a result object without throwing an error.
   *
   * @param data The object to validate.
   * @returns A `SafeParseResult` object.
   *
   * @example
   * const result = userSchema.safeParse({ name: "T" });
   * if (result.success) {
   *   console.log("Welcome,", result.data.name);
   * } else {
   *   console.error(result.errors); // { name: "Must be at least 2 characters" }
   * }
   */
  safeParse: (data: unknown) => SafeParseResult<T>;
  /**
   * Validates the input and returns the validated data on success, or throws an error on failure.
   *
   * @param data The object to validate.
   * @returns The validated data.
   * @throws {Error} If validation fails.
   */
  parse: (data: unknown) => T;
};

// --- Core Validation Logic ---

/**
 * Create a schema validator from a plain object schema.
 *
 * This factory builds a validator that can be used in two ways:
 * - As a callable: `const maybe = schema(data)` — returns the validated data or `null`.
 * - With helpers: `schema.safeParse(data)` and `schema.parse(data)` for structured results
 *
 * Inputs are validated without coercion. Error messages are collected in a
 * record keyed by object path (e.g. `user.email` or `items[2]`).
 *
 * @template T The expected runtime shape of the validated object.
 * @param schema An object mapping keys to `FieldValidator` instances.
 * @returns A `SchemaValidator<T>` that contains `safeParse` and `parse` helpers.
 *
 * @example
 * const userSchema = createSchema({ name: v.string.min(2), age: v.number.optional() });
 * const r = userSchema.safeParse({ name: "Joe" });
 */
export function createSchema<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>
): SchemaValidator<T> {
  const schemaKeys = Object.keys(schema) as (keyof T)[];

  const safeParse = (data: unknown): SafeParseResult<T> => {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return {
        success: false,
        errors: { _root: "Expected an object" },
      };
    }

    const source = data as Record<string, unknown>;
    const result: Partial<T> = {};
    const errors: Record<string, string> = {};

    for (const key of schemaKeys) {
      const validator = schema[key];
      const value = source[key as string];
      const validatedValue = validator(value, { path: String(key), errors });

      if (validatedValue !== undefined) {
        result[key] = validatedValue;
      } else if (value !== undefined && !errors[String(key)]) {
        // Value was provided but failed validation; error must be already recorded by validator
        errors[String(key)] = "Invalid value";
      }
    }

    // Ensure all required fields are present in the result.
    for (const key of schemaKeys) {
      const validator = schema[key];
      // Determine optionality by invoking the validator with `undefined`
      // and checking whether it recorded an error for that path.
      const optionalErrors: Record<string, string> = {};
      // Run validator to let it set an error into optionalErrors if required
      // (validators write errors using the provided path).
      try {
        // We ignore the return value; presence/absence of an error tells us optionality
        validator(undefined, { path: String(key), errors: optionalErrors });
      } catch {
        /* validators should not throw; ignore to be defensive */
      }
      const isOptional = optionalErrors[String(key)] === undefined;

      if (!isOptional && result[key] === undefined && !errors[String(key)]) {
        errors[String(key)] = "Required field is missing";
      }
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: result as T };
  };

  const callable = ((data: unknown): T | null => {
    const res = safeParse(data);
    return res.success ? res.data : null;
  }) as SchemaValidator<T>;

  callable.safeParse = safeParse;
  callable.parse = (data: unknown): T => {
    const res = safeParse(data);
    if (res.success) return res.data;
    throw new ValidationError(res.errors);
  };

  return callable;
}

// --- Base Validator ---

type Rule<T> = { check: (value: T) => boolean; msg?: string };

/**
 * Creates a base field validator.
 * @internal
 */
function createValidator<T>(
  type: string,
  typeCheck: (value: unknown) => value is T
): FieldValidator<T> {
  const base = (
    allowUndefined: boolean,
    allowNull: boolean,
    customMessage: string | undefined,
    rules: Rule<T>[]
  ): FieldValidator<T> => {
    const fn = ((value: unknown, ctx?: ValidationContext): T | undefined => {
      const path = ctx?.path ?? "";
      const err = (m: string) => {
        if (!ctx) return;
        // Normalize empty path to a canonical root key
        const pathKey = path || "_root";
        if (!ctx.errors[pathKey]) {
          // Only set error if not already set
          ctx.errors[pathKey] = m;
        }
      };

      if (value === undefined) {
        if (allowUndefined) return undefined;
        err(customMessage || "Required field is missing");
        return undefined;
      }
      if (value === null) {
        if (allowNull) return null as unknown as T; // Cast to T, which will be T | null
        err(customMessage || "Cannot be null");
        return undefined;
      }
      if (!typeCheck(value)) {
        err(customMessage || `Expected ${type}`);
        return undefined;
      }
      for (const r of rules) {
        if (!r.check(value)) {
          err(r.msg || customMessage || "Invalid value");
          return undefined;
        }
      }
      return value;
    }) as FieldValidator<T>;

    fn.optional = () =>
      base(true, allowNull, customMessage, rules) as FieldValidator<
        T | undefined
      >;
    // nullable should allow null values but not treat the field as optional.
    // Keep allowUndefined as-is so nullable fields still require presence
    // unless explicitly marked optional().
    fn.nullable = () =>
      base(
        allowUndefined,
        true,
        customMessage,
        rules
      ) as FieldValidator<T | null>;
    fn.message = (msg: string) => {
      return base(allowUndefined, allowNull, msg, rules);
    };
    fn.refine = (predicate: (v: T) => boolean, msg?: string) => {
      return base(allowUndefined, allowNull, customMessage, [
        ...rules,
        { check: predicate, msg },
      ]);
    };

    return fn;
  };

  return base(false, false, undefined, []);
}

// --- Specialized Validators ---

/**
 * Creates a string validator.
 * @internal
 */
function createStringValidator(defaultMessage?: string): StringFieldValidator {
  const validator = createValidator(
    "string",
    (v): v is string => typeof v === "string"
  );
  const finalValidator = defaultMessage
    ? validator.message(defaultMessage)
    : validator;

  // Wrap a plain FieldValidator<string> and attach the string-specific
  // helper methods so that chaining (e.g. v.string.min(...).max(...))
  // continues to return a validator with the same API.
  const wrap = (vv: FieldValidator<string>): StringFieldValidator => {
    // Create a fresh wrapper function that delegates to the underlying
    // validator `vv` so we don't mutate the original object (which would
    // cause recursive method calls).
    const w = ((value: unknown, ctx?: ValidationContext) =>
      vv(value, ctx)) as StringFieldValidator;

    w.min = (n: number, msg?: string) =>
      wrap(
        vv.refine(
          (v) => v.length >= n,
          msg || `Must be at least ${n} characters`
        ) as FieldValidator<string>
      );

    w.max = (n: number, msg?: string) =>
      wrap(
        vv.refine(
          (v) => v.length <= n,
          msg || `Must be at most ${n} characters`
        ) as FieldValidator<string>
      );

    w.regex = (pattern: RegExp, msg?: string) =>
      wrap(
        vv.refine(
          (v) => pattern.test(v),
          msg || "Invalid format"
        ) as FieldValidator<string>
      );

    w.optional = () => wrap(vv.optional() as FieldValidator<string>);
    w.nullable = () => wrap(vv.nullable() as FieldValidator<string>);
    w.message = (msg: string) =>
      wrap(vv.message(msg) as FieldValidator<string>);
    w.refine = (predicate: (v: string) => boolean, msg?: string) =>
      wrap(vv.refine(predicate, msg) as FieldValidator<string>);

    return w;
  };

  return wrap(finalValidator);
}

/**
 * Creates an email validator.
 * @internal
 */
function createEmailValidator(defaultMessage?: string): StringFieldValidator {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return createStringValidator(defaultMessage).regex(
    emailRe,
    "Invalid email address"
  );
}

/**
 * Creates a number validator.
 * @internal
 */
function createNumberValidator(defaultMessage?: string): NumberFieldValidator {
  const validator = createValidator(
    "number",
    (v): v is number => typeof v === "number" && !isNaN(v)
  );
  const finalValidator = defaultMessage
    ? validator.message(defaultMessage)
    : validator;

  const wrap = (vv: FieldValidator<number>): NumberFieldValidator => {
    const w = ((value: unknown, ctx?: ValidationContext) =>
      vv(value, ctx)) as NumberFieldValidator;

    w.min = (n: number, msg?: string) =>
      wrap(
        vv.refine(
          (v) => v >= n,
          msg || `Must be at least ${n}`
        ) as FieldValidator<number>
      );

    w.max = (n: number, msg?: string) =>
      wrap(
        vv.refine(
          (v) => v <= n,
          msg || `Must be at most ${n}`
        ) as FieldValidator<number>
      );

    w.optional = () => wrap(vv.optional() as FieldValidator<number>);
    w.nullable = () => wrap(vv.nullable() as FieldValidator<number>);
    w.message = (msg: string) =>
      wrap(vv.message(msg) as FieldValidator<number>);
    w.refine = (predicate: (v: number) => boolean, msg?: string) =>
      wrap(vv.refine(predicate, msg) as FieldValidator<number>);

    return w;
  };

  return wrap(finalValidator);
}

/**
 * Creates a boolean validator.
 * @internal
 */
function createBooleanValidator(
  defaultMessage?: string
): FieldValidator<boolean> {
  const validator = createValidator(
    "boolean",
    (v): v is boolean => typeof v === "boolean"
  );
  return defaultMessage ? validator.message(defaultMessage) : validator;
}

/**
 * Creates a validator for an object with a given schema.
 *
 * @template T The type of the object to validate.
 * @param schema The validation schema.
 * @returns A `FieldValidator<T>` for the object.
 *
 * @example
 * const userSchema = v.object({
 *   name: v.string.min(2),
 *   email: v.email(),
 * });
 */
function object<T extends Record<string, unknown>>(
  schema: ValidationSchema<T>
): SchemaValidator<T> & FieldValidator<T> {
  // Build a full schema validator (can be used as a top-level schema)
  const schemaValidator = createSchema<T>(schema);

  // Base field-level validator (used when nested inside other objects)
  const baseField = createValidator("object", (v): v is T => {
    const res = schemaValidator.safeParse(v);
    return res.success;
  });

  // A wrapper that behaves as both a SchemaValidator (call with a single arg)
  // and as a FieldValidator (call with ctx to collect errors).
  const wrapper = ((value: unknown, ctx?: ValidationContext) => {
    if (ctx === undefined) {
      // Called as a top-level schema function: return data or null
      return schemaValidator(value);
    }

    // Called as a field validator with context: propagate nested errors
    const res = schemaValidator.safeParse(value);
    if (!res.success) {
      // Propagate nested errors with path prefix (preserve existing errors)
      for (const [k, v] of Object.entries(res.errors)) {
        const valMsg = v || "Invalid value";
        if (k === "_root") {
          if (ctx.path) {
            if (!ctx.errors[ctx.path]) ctx.errors[ctx.path] = valMsg;
          } else if (!ctx.errors._root) ctx.errors._root = valMsg;
        } else {
          const joined = ctx.path
            ? k.startsWith("[")
              ? `${ctx.path}${k}`
              : `${ctx.path}.${k}`
            : k;
          if (!ctx.errors[joined]) ctx.errors[joined] = valMsg;
        }
      }
      return undefined;
    }

    return res.data;
  }) as unknown as SchemaValidator<T> & FieldValidator<T>;

  // Attach safeParse and parse from the internal schema validator
  wrapper.safeParse = schemaValidator.safeParse;
  wrapper.parse = schemaValidator.parse;

  // Copy field-level helpers (optional, nullable, message, refine)
  wrapper.optional = baseField.optional;
  wrapper.nullable = baseField.nullable;
  wrapper.message = baseField.message;
  wrapper.refine = baseField.refine;

  return wrapper;
}

/**
 * Creates a validator for an array of a certain type.
 *
 * @template T The type of the array items.
 * @param itemValidator The validator for each item in the array.
 * @returns A `FieldValidator<T[]>` for the array.
 *
 * @example
 * const tagsSchema = v.array(v.string.min(1));
 * const result = tagsSchema.safeParse(["tag1", ""]);
 * // result.errors will be: { "[1]": "Must be at least 1 characters" }
 */
function array<T>(
  itemValidator: FieldValidator<T>
): ArrayFieldValidator<T> & SchemaValidator<T[]> {
  const arrayValidator = (
    value: unknown,
    ctx?: ValidationContext
  ): T[] | undefined => {
    if (!Array.isArray(value)) {
      if (ctx) {
        const key = ctx.path || "_root";
        if (!ctx.errors[key]) ctx.errors[key] = "Expected an array";
      }
      return undefined;
    }

    const results: T[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const itemCtx: ValidationContext | undefined = ctx
        ? { ...ctx, path: ctx.path ? `${ctx.path}[${i}]` : `[${i}]` }
        : undefined;

      const validatedItem = itemValidator(item, itemCtx);

      if (validatedItem === undefined) {
        // If itemValidator didn't set a specific indexed error, add a generic one
        if (itemCtx && !itemCtx.errors[itemCtx.path]) {
          itemCtx.errors[itemCtx.path] = "Invalid array item";
        }
        return undefined;
      }
      results.push(validatedItem as T);
    }

    return results;
  };

  // Base validator: checks it's an array and items validate (without context)
  const base = createValidator("array", (v): v is T[] => {
    return (
      Array.isArray(v) && v.every((item) => itemValidator(item) !== undefined)
    );
  });

  // final performs the boolean checks (used when no ValidationContext is supplied)
  const finalRaw = base.refine((v) => arrayValidator(v) !== undefined);

  // Wrap array validators so chaining keeps the array-specific helpers.
  const wrapArray = (vv: FieldValidator<T[]>): ArrayFieldValidator<T> => {
    const w = ((value: unknown, ctx?: ValidationContext) =>
      vv(value, ctx)) as ArrayFieldValidator<T>;

    w.min = (n: number, msg?: string) =>
      wrapArray(
        vv.refine(
          (arr: T[]) => Array.isArray(arr) && arr.length >= n,
          msg || `Must contain at least ${n} items`
        ) as FieldValidator<T[]>
      );

    w.max = (n: number, msg?: string) =>
      wrapArray(
        vv.refine(
          (arr: T[]) => Array.isArray(arr) && arr.length <= n,
          msg || `Must contain at most ${n} items`
        ) as FieldValidator<T[]>
      );

    w.optional = () => wrapArray(vv.optional() as FieldValidator<T[]>);
    w.nullable = () => wrapArray(vv.nullable() as FieldValidator<T[]>);
    w.message = (msg: string) =>
      wrapArray(vv.message(msg) as FieldValidator<T[]>);
    w.refine = (predicate: (v: T[]) => boolean, msg?: string) =>
      wrapArray(vv.refine(predicate, msg) as FieldValidator<T[]>);

    return w;
  };

  const final = wrapArray(finalRaw);

  // Wrapped validator: when called with a ValidationContext, run the
  // richer arrayValidator so indexed item errors are recorded; otherwise
  // delegate to `final` which only needs to return boolean-like checks.
  const wrapped = ((value: unknown, ctx?: ValidationContext) => {
    if (ctx) {
      return arrayValidator(value, ctx);
    }
    // Called without context - use final for value-only validation
    return final(value);
  }) as ArrayFieldValidator<T> & SchemaValidator<T[]>;

  // Copy helpers from `final` onto the wrapper so the API matches
  wrapped.min = final.min;
  wrapped.max = final.max;
  wrapped.optional = final.optional;
  wrapped.nullable = final.nullable;
  wrapped.message = final.message;
  wrapped.refine = final.refine;

  // Provide top-level safeParse/parse so this field validator can be used
  // standalone as a schema (useful in tests and when validating root arrays).
  wrapped.safeParse = (value: unknown) => {
    const errors: Record<string, string> = {};
    const res = arrayValidator(value, { path: "", errors });
    if (res === undefined) return { success: false, errors };
    return { success: true, data: res } as SafeParseSuccess<T[]>;
  };

  wrapped.parse = (value: unknown) => {
    const r = wrapped.safeParse(value) as SafeParseResult<T[]>;
    if (r.success) return r.data;
    throw new ValidationError(r.errors);
  };

  return wrapped;
}

// --- Exports ---

/**
 * Factory shape for string-like validators exposed on `v`.
 * This type describes a callable that returns a validator and also
 * exposes the common rule helpers as properties. Providing this
 * explicit type avoids the callable being widened to `any` which
 * results in noisy/incorrect IntelliSense suggestions in editors.
 */
type StringFactory = {
  (message?: string): StringFieldValidator;
  min: (n: number, msg?: string) => StringFieldValidator;
  max: (n: number, msg?: string) => StringFieldValidator;
  regex: (pattern: RegExp, msg?: string) => StringFieldValidator;
  optional: () => FieldValidator<string | undefined>;
  nullable: () => FieldValidator<string | null>;
  message: (msg: string) => FieldValidator<string>;
  refine: (
    predicate: (v: string) => boolean,
    msg?: string
  ) => FieldValidator<string>;
};

type NumberFactory = {
  (message?: string): NumberFieldValidator;
  min: (n: number, msg?: string) => NumberFieldValidator;
  max: (n: number, msg?: string) => NumberFieldValidator;
  optional: () => FieldValidator<number | undefined>;
  nullable: () => FieldValidator<number | null>;
  message: (msg: string) => FieldValidator<number>;
  refine: (
    predicate: (v: number) => boolean,
    msg?: string
  ) => FieldValidator<number>;
};

type BooleanFactory = {
  (message?: string): FieldValidator<boolean>;
  optional: () => FieldValidator<boolean | undefined>;
  nullable: () => FieldValidator<boolean | null>;
  message: (msg: string) => FieldValidator<boolean>;
  refine: (
    predicate: (v: boolean) => boolean,
    msg?: string
  ) => FieldValidator<boolean>;
};

/**
 * Helper type to infer the output type from a `SchemaValidator`.
 * @internal
 */
type InferSchema<S> = S extends SchemaValidator<infer U> ? U : never;

/**
 *
 * The `v` object is the single entry point for building validators. It exposes
 * factory functions for primitive validators and helpers to compose nested
 * schemas. Each factory returns a chainable validator with the following
 * common modifiers: `.min()`, `.max()`, `.optional()`, `.nullable()`,
 * `.message()` and `.refine()`.
 *
 * - Validators are non-coercing: inputs must already be the correct runtime
 *   type (no implicit conversion).
 * - Use `safeParse` when you want structured error results and `parse` when you
 *   prefer exceptions on failure.
 *
 * Short API reference:
 * - v.string(message?) -> string validator
 * - v.email(message?)  -> common email validator (uses a simple regex)
 * - v.number(message?) -> number validator
 * - v.boolean(message?) -> boolean validator
 * - v.object(schema) -> object/schema validator (can be used as top-level or nested)
 * - v.array(itemValidator) -> array validator for item type
 *
 * Example usage:
 *
 * ```typescript
 * const user = v.object({
 *   name: v.string.min(2),
 *   email: v.email(),
 *   age: v.number.optional(),
 * });
 *
 * const result = user.safeParse({
 *   name: 'A',
 *   email: 'x@e.com'
 * });
 *
 * if (!result.success) {
 *  console.error(result.errors); // { name: "Must be at least 2 characters" }
 * }
 * ```
 */
const v: {
  string: StringFactory;
  email: StringFactory;
  number: NumberFactory;
  boolean: BooleanFactory;
  object: typeof object;
  array: typeof array;
} = {
  /**
   * Creates a string validator.
   */
  string: (() => {
    const fn = (message?: string) => createStringValidator(message);
    const base = createStringValidator();
    fn.min = base.min;
    fn.max = base.max;
    fn.regex = base.regex;
    fn.optional = base.optional;
    fn.nullable = base.nullable;
    fn.message = base.message;
    fn.refine = base.refine;
    return fn;
  })(),
  /**
   * Creates an email validator.
   */
  email: (() => {
    const fn = (message?: string) => createEmailValidator(message);
    const base = createEmailValidator();
    fn.min = base.min;
    fn.max = base.max;
    fn.regex = base.regex;
    fn.optional = base.optional;
    fn.nullable = base.nullable;
    fn.message = base.message;
    fn.refine = base.refine;
    return fn;
  })(),
  /**
   * Creates a number validator.
   */
  number: (() => {
    const fn = (message?: string) => createNumberValidator(message);
    const base = createNumberValidator();
    fn.min = base.min;
    fn.max = base.max;
    fn.optional = base.optional;
    fn.nullable = base.nullable;
    fn.message = base.message;
    fn.refine = base.refine;
    return fn;
  })(),
  /**
   * Creates a boolean validator.
   */
  boolean: (() => {
    const fn = (message?: string) => createBooleanValidator(message);
    const base = createBooleanValidator();
    fn.optional = base.optional;
    fn.nullable = base.nullable;
    fn.message = base.message;
    fn.refine = base.refine;
    return fn;
  })(),

  object,
  array,
};

/**
 *
 * - Namespace containing helper types for inferring schema types.
 *
 * ```typescript
 * type User = v.infer<typeof schema>;
 * // User is { name: string; age?: number }
 * ```
 */
// Allow a merged type namespace for the `v` value to expose `v.infer`.
// ESLint prefers ES2015 module syntax over `namespace`, but we intentionally
// use declaration merging here to provide `v.infer` as a convenient helper
// type: callers can write `type User = v.infer<typeof schema>`.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace v {
  /**
   * Helper type to infer the output type from a `SchemaValidator`.
   *
   * @template T The schema validator type.
   */
  export type infer<T> = InferSchema<T>;
}

export default v;
