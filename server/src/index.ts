import { createGreeting } from "@monorepo/shared";

export function buildStartupMessage(name: string): string {
  return createGreeting(name).message;
}
