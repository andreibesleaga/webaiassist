// SPDX-License-Identifier: Apache-2.0
// The eval prompts (docs/eval/prompts.json): checked on load, with the target's item slugs
// filled in for {a} and {b}.
import { readFileSync } from 'node:fs';

export interface EvalPrompt {
  readonly n: number;
  readonly text: string;
  /** Expected tool calls in order; empty means an answer without a tool. */
  readonly tools: readonly string[];
  /** Other tools that also serve as the first step (for "task done"); empty when absent. */
  readonly accept?: readonly string[];
  /** The answer must contain one of these on the stub node. */
  readonly facts: readonly string[];
  /** What the scripted test model is told. */
  readonly scripted: string;
}

export interface EvalTarget {
  readonly url?: string;
  readonly slugs: Readonly<Record<string, string>>;
}

export interface PromptFile {
  readonly targets: Readonly<Record<string, EvalTarget>>;
  readonly prompts: readonly EvalPrompt[];
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function checkPrompt(raw: unknown, index: number): EvalPrompt {
  const p = (raw ?? {}) as Record<string, unknown>;
  const where = `prompts.json: prompt ${index + 1}`;
  if (typeof p.text !== 'string' || typeof p.scripted !== 'string') {
    throw new Error(`${where}: text and scripted must be strings`);
  }
  if (!strings(p.tools) || !strings(p.facts))
    throw new Error(`${where}: tools and facts must be string lists`);
  if (p.accept !== undefined && !strings(p.accept))
    throw new Error(`${where}: accept must be a string list`);
  return {
    n: Number(p.n),
    text: p.text,
    tools: p.tools,
    facts: p.facts,
    scripted: p.scripted,
    ...(p.accept === undefined ? {} : { accept: p.accept }),
  };
}

export function parsePrompts(raw: unknown): PromptFile {
  const file = (raw ?? {}) as { targets?: unknown; prompts?: unknown };
  if (typeof file.targets !== 'object' || file.targets === null)
    throw new Error('prompts.json: no targets');
  if (!Array.isArray(file.prompts)) throw new Error('prompts.json: no prompts list');
  return {
    targets: file.targets as Record<string, EvalTarget>,
    prompts: file.prompts.map((p, i) => checkPrompt(p, i)),
  };
}

export function loadPrompts(path: string): PromptFile {
  return parsePrompts(JSON.parse(readFileSync(path, 'utf8')));
}

const fill = (text: string, slugs: Readonly<Record<string, string>>): string =>
  text.replace(/\{([ab])\}/g, (match, key: string) => slugs[key] ?? match);

/** The first `limit` prompts with the target's slugs filled in. */
export function promptsFor(file: PromptFile, target: string, limit: number): EvalPrompt[] {
  const slugs = file.targets[target]?.slugs;
  if (!slugs) throw new Error(`prompts.json: no target "${target}"`);
  return file.prompts.slice(0, limit).map((p) => ({
    ...p,
    text: fill(p.text, slugs),
    scripted: fill(p.scripted, slugs),
    facts: p.facts.map((f) => fill(f, slugs)),
  }));
}
