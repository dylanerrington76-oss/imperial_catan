import { describe, expect, it } from "vitest";
import { buildStartupMessage } from "./index.js";

describe("buildStartupMessage", () => {
  it("builds a message using the shared greeting", () => {
    expect(buildStartupMessage("Server")).toBe("Hello, Server!");
  });
});
