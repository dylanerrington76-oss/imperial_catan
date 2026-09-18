import { createGreeting } from "@monorepo/shared";

export function renderWelcomeText(name: string): string {
  return createGreeting(name).message.toUpperCase();
}
