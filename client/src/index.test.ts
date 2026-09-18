import { describe, expect, it } from "vitest";
import { renderWelcomeText } from "./index.js";

describe("renderWelcomeText", () => {
  it("uppercases the shared greeting message", () => {
    expect(renderWelcomeText("Client")).toBe("HELLO, CLIENT!");
  });
});
