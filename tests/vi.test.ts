import { describe, it, expect } from "vitest";
import v from "../src/index.js";

/**
 * Utility to log inputs, outputs, and errors clearly.
 */
function logResult(
  testName: string,
  input: unknown,
  result: unknown,
  error?: unknown
) {
  console.log("==== TEST ====", testName);
  console.log("Input:", input);
  console.log("Result:", result);
  if (error) console.log("Error:", error);
  console.log("\n");
}

describe("js-validator full feature tests", () => {
  // --- STRING TESTS ---
  it("string validation: min/max/regex/refine/optional/nullable/message", () => {
    const schema = v.object({
      name: v.string
        .min(2, "Name too short")
        .max(10)
        .regex(/^[A-Za-z]+$/, "Only letters")
        .refine((v) => v !== "Admin", "Cannot be Admin"),
      nickname: v.string.optional().nullable(),
    });

    const testCases = [
      { input: { name: "A" }, fail: true },
      { input: { name: "ThisNameIsWayTooLong" }, fail: true },
      { input: { name: "Admin" }, fail: true },
      { input: { name: "John123" }, fail: true },
      { input: { name: "John", nickname: null }, fail: false },
      { input: { name: "Alice" }, fail: false },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("STRING TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- EMAIL TESTS ---
  it("email validation: format and optional", () => {
    const schema = v.object({
      email: v.email.message("Must be a valid email").optional(),
    });

    const testCases = [
      { input: {}, fail: false },
      { input: { email: "invalidemail" }, fail: true },
      { input: { email: "user@test.com" }, fail: false },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("EMAIL TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- NUMBER TESTS ---
  it("number validation: min/max/refine/optional/nullable", () => {
    const schema = v.object({
      age: v.number
        .min(18)
        .max(60)
        .refine((n) => n % 2 === 0, "Must be even"),
      score: v.number.optional().nullable(),
    });

    const testCases = [
      { input: { age: 15 }, fail: true },
      { input: { age: 61 }, fail: true },
      { input: { age: 25 }, fail: true },
      { input: { age: 24, score: null }, fail: false },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("NUMBER TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- BOOLEAN TESTS ---
  it("boolean validation: optional/nullable/refine/message", () => {
    const schema = v.object({
      active: v.boolean.refine((v) => v === true, "Must be true"),
      verified: v.boolean.optional(),
    });

    const testCases = [
      { input: { active: false }, fail: true },
      { input: { active: true }, fail: false },
      { input: { active: true, verified: false }, fail: false },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("BOOLEAN TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- ARRAY TESTS ---
  it("array validation: min/max items, nested string validation", () => {
    const schema = v.object({
      tags: v.array(v.string.min(2)).min(1).max(3),
    });

    const testCases = [
      { input: { tags: [] }, fail: true },
      { input: { tags: ["a"] }, fail: true },
      { input: { tags: ["ok", "yes"] }, fail: false },
      { input: { tags: ["ok", "yes", "fine", "extra"] }, fail: true },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("ARRAY TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- NESTED OBJECT TESTS ---
  it("nested object validation and propagation of errors", () => {
    const schema = v.object({
      user: v.object({
        username: v.string.min(3),
        profile: v.object({
          bio: v.string.optional(),
        }),
      }),
    });

    const testCases = [
      { input: { user: { username: "Al" } }, fail: true },
      { input: { user: { username: "Alice", profile: {} } }, fail: false },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("NESTED OBJECT TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- PARSE THROW TEST ---
  it("parse method throws on invalid input", () => {
    const schema = v.object({
      name: v.string.min(2),
    });

    try {
      schema.parse({ name: "A" });
    } catch (err: any) {
      logResult("PARSE THROW TEST", { name: "A" }, null, err.message);
      expect(err.message).toContain("[ERR_VALIDATION]");
    }
  });

  // --- OPTIONAL / NULLABLE TESTS ---
  it("optional and nullable fields work as expected", () => {
    const schema = v.object({
      optionalField: v.string.optional(),
      nullableField: v.number.nullable(),
    });

    const testCases = [
      { input: {}, fail: true },
      { input: { optionalField: undefined, nullableField: null }, fail: false },
      { input: { optionalField: 123 }, fail: true },
      { input: { nullableField: "abc" }, fail: true },
    ];

    for (const { input, fail } of testCases) {
      const res = schema.safeParse(input);
      logResult("OPTIONAL/NULLABLE TEST", input, res);
      expect(res.success).toBe(!fail);
    }
  });

  // --- TYPE INFERENCE TEST ---
  it("v.infer type test", () => {
    const schema = v.object({
      id: v.string.min(1),
      count: v.number.optional(),
    });

    // Use the exported type helper to infer the schema's TypeScript type.
    type Inferred = v.infer<typeof schema>;

    // This value should conform to the inferred type at compile-time
    // and pass runtime validation.
    const example: Inferred = { id: "abc", count: undefined };

    const res = schema.safeParse(example);
    logResult("INFER TEST", example, res);
    expect(res.success).toBe(true);
  });
});
