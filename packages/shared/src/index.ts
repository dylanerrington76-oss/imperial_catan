export * from "./hex/index.js";

export interface Greeting {
  message: string;
  createdAt: Date;
}

export function createGreeting(name: string): Greeting {
  return {
    message: `Hello, ${name}!`,
    createdAt: new Date(),
  };
}
