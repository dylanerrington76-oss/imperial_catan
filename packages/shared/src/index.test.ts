import { describe, expect, it } from "vitest";
import { createGreeting } from "./index.js";

describe("createGreeting", () => {
  it("includes the given name in the message", () => {
    const greeting = createGreeting("World");
    expect(greeting.message).toBe("Hello, World!");
    expect(greeting.createdAt).toBeInstanceOf(Date);
  });
});
