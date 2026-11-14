// SPDX-License-Identifier: Apache-2.0
// `npm run eval:endpoint`: the real EndpointRuntime (streaming on) with the agent loop and the
// ten tools of the stub node, against the address, model and key from the environment. Five short
// questions of docs/eval/prompts.json; per question: the tools used, the time, the tokens and the
// price the service returned. Writes docs/eval/EVAL-ENDPOINT-<host>-<date>.json (no key in it).
// Bundled and started by scripts/eval/endpoint.mjs, because the sources import without extensions.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AjvArgsValidator } from '../../src/adapters/ajv-args-validator.ts';
import { EndpointRuntime } from '../../src/adapters/endpoint-runtime.ts';
import { runAgent } from '../../src/core/agent-loop.ts';
import type { ChatRequest, ModelRuntime, ModelUsage } from '../../src/core/ports/model-runtime.ts';
import type { ToolInfo } from '../../src/core/types.ts';
import { FakeChatUI } from '../../src/fakes/fake-chat-ui.ts';
import { FakeToolBridge } from '../../src/fakes/fake-tool-bridge.ts';
import { FixedClock } from '../../src/fakes/fixed-clock.ts';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory.ts';
import { buildReport, endpointFromEnv, reportText, type EndpointRow } from './endpoint-plan.ts';
import { loadPrompts, promptsFor, type EvalPrompt } from './prompts.ts';
import { taskDone, type Observation } from './score.ts';

const ORIGIN = 'https://stub.node.example';
const TAB = 1;
const QUESTIONS = 5;

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const tools = (read('fixtures/agsc-tools.json') as { tools: ToolInfo[] }).tools;
const canned = (read('fixtures/agsc-answers.json') as { answers: Record<string, string> }).answers;

/** The model with every call's usage added up, as the activity log will do. */
function counting(inner: ModelRuntime, total: { usage: ModelUsage[] }): ModelRuntime {
  return {
    load: (id, onProgress, signal) => inner.load(id, onProgress, signal),
    unload: () => inner.unload(),
    capabilities: () => inner.capabilities(),
    chat: (request: ChatRequest) =>
      inner.chat({ ...request, onUsage: (usage) => total.usage.push(usage) }),
  };
}

function stubNode(): FakeToolBridge {
  const bridge = new FakeToolBridge(tools, ORIGIN);
  for (const tool of tools) {
    bridge.handle(tool.name, (args) => ({
      ok: true,
      text: `${canned[tool.name] ?? 'Stub node answer.'} Arguments: ${JSON.stringify(args)}`,
    }));
  }
  return bridge;
}

/** The run in the shape the scorer reads (scripts/eval/score.ts). */
function seenBy(used: readonly string[], result: { answer?: string; error?: string }): Observation {
  return {
    tools: used,
    gates: used,
    answer: result.answer ?? '',
    errors: result.error === undefined ? [] : [result.error],
    repeated: 0,
    firstTokenMs: null,
    totalMs: 0,
    timedOut: false,
  };
}

async function askOne(runtime: ModelRuntime, prompt: EvalPrompt): Promise<EndpointRow> {
  const total = { usage: [] as ModelUsage[] };
  const bridge = stubNode();
  const deps = {
    model: counting(runtime, total),
    bridge,
    memory: new InMemoryMemory(),
    ui: new FakeChatUI(true),
    clock: new FixedClock(),
    validator: new AjvArgsValidator(),
  };
  const started = performance.now();
  const result = await runAgent(deps, { userText: prompt.text, tabId: TAB, origin: ORIGIN });
  const used = bridge.calls.map((c) => c.name);
  const costs = total.usage.flatMap((u) => (u.costUsd === undefined ? [] : [u.costUsd]));
  return {
    n: prompt.n,
    text: prompt.text,
    tools: used,
    toolRight: JSON.stringify(used) === JSON.stringify(prompt.tools),
    taskDone: taskDone(prompt, seenBy(used, result), 'stub') === 1,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    modelCalls: total.usage.length,
    promptTokens: total.usage.reduce((a, u) => a + (u.promptTokens ?? 0), 0),
    completionTokens: total.usage.reduce((a, u) => a + (u.completionTokens ?? 0), 0),
    costUsd: costs.length === 0 ? null : costs.reduce((a, b) => a + b, 0),
    answer: (result.answer ?? '').slice(0, 300),
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

async function main(): Promise<void> {
  const config = endpointFromEnv(process.env);
  const runtime = new EndpointRuntime(config, (url, init) => fetch(url, init));
  await runtime.load(config.model, () => undefined);
  const file = loadPrompts('docs/eval/prompts.json');
  const rows: EndpointRow[] = [];
  for (const prompt of promptsFor(file, 'stub', QUESTIONS)) {
    rows.push(await askOne(runtime, prompt));
    const row = rows.at(-1);
    console.log(`#${row?.n} tools=${JSON.stringify(row?.tools)} ${row?.seconds}s`);
  }
  await runtime.unload();
  const date = new Date().toISOString().slice(0, 10);
  const text = reportText(buildReport(config, date, rows), config.apiKey ?? '');
  mkdirSync('docs/eval', { recursive: true });
  writeFileSync(
    join('docs/eval', `EVAL-ENDPOINT-${new URL(config.url).hostname}-${date}.json`),
    `${text}\n`,
  );
  console.log(text);
}

main().catch((error: unknown) => {
  const key = process.env.WEBAIASSIST_ENDPOINT_KEY ?? '';
  const text = error instanceof Error ? error.message : String(error);
  console.error(key.length >= 4 ? text.split(key).join('[key]') : text);
  process.exitCode = 1;
});
