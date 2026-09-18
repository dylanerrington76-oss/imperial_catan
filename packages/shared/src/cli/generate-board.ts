#!/usr/bin/env node
/**
 * Standalone script: given a numeric seed, deterministically generates the
 * Imperial Catan board and prints it as JSON.
 *
 * Usage:
 *   tsx src/cli/generate-board.ts 42        (dev, no build step)
 *   node dist/cli/generate-board.js 42      (after `npm run build`)
 *
 * The board JSON goes to stdout (so it's pipeable/redirectable); a
 * human-readable summary goes to stderr.
 */
import { generateBoard, summarizeBoard } from "../hex/index.js";

function parseSeed(argv: readonly string[]): number {
  const raw = argv[2];
  if (raw === undefined || raw.trim().length === 0) {
    throw new Error("Usage: generate-board <numeric-seed>");
  }
  const seed = Number(raw);
  if (!Number.isFinite(seed)) {
    throw new Error(`Seed must be a finite number, received: "${raw}"`);
  }
  return seed;
}

function main(): void {
  const seed = parseSeed(process.argv);
  const board = generateBoard(seed);

  process.stderr.write(`${summarizeBoard(board)}\n\n`);
  process.stdout.write(`${JSON.stringify(board)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
