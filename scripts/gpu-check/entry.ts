// SPDX-License-Identifier: Apache-2.0
// The page side of scripts/gpu-check/run.ts: WebLLM alone (no extension), one model, one chat.
import { CreateMLCEngine, type InitProgressReport, type MLCEngine } from '@mlc-ai/web-llm';
import { limitPrefillChunk } from '../../src/adapters/prefill-chunk';

interface Outcome {
  readonly ok: boolean;
  readonly loadS: number;
  readonly warmS: number | null;
  readonly firstTokenS: number | null;
  readonly tokens: number;
  readonly totalS: number;
  readonly text: string;
  readonly error: string | null;
}

const log = (line: string): void => console.log(`[gpu-check] ${line}`);
const seconds = (since: number): number => (performance.now() - since) / 1000;

async function generate(engine: MLCEngine, promptWords: number) {
  const filler = Array.from({ length: promptWords }, (_, i) => `item${i}`).join(' ');
  const messages = [
    { role: 'system' as const, content: `You answer briefly. Context list: ${filler}` },
    {
      role: 'user' as const,
      content: 'Reply with one short sentence about the list, then the word DONE.',
    },
  ];
  const t0 = performance.now();
  let first: number | null = null;
  let tokens = 0;
  let text = '';
  const chunks = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.2,
    extra_body: { enable_thinking: false },
  });
  for await (const chunk of chunks) {
    const piece = chunk.choices[0]?.delta.content ?? '';
    if (piece === '') continue;
    first ??= seconds(t0);
    tokens += 1;
    text += piece;
  }
  return { firstTokenS: first, tokens, totalS: seconds(t0), text: text.slice(0, 200) };
}

/** A warm-up question: the first generation compiles the shaders (tens of seconds on some GPUs). */
async function warmUp(engine: MLCEngine): Promise<number> {
  const began = performance.now();
  const chunks = await engine.chat.completions.create({
    messages: [{ role: 'user', content: 'Say OK.' }],
    stream: true,
    extra_body: { enable_thinking: false },
  });
  for await (const chunk of chunks) void chunk;
  return seconds(began);
}

async function check(modelId: string, promptWords: number, chunk: number): Promise<Outcome> {
  const began = performance.now();
  const adapter = await navigator.gpu?.requestAdapter();
  log(`adapter: ${adapter ? 'yes' : 'no'}; f16: ${adapter?.features.has('shader-f16') ?? false}`);
  const failed = (error: unknown, loadS: number, warmS: number | null): Outcome => ({
    ok: false,
    loadS,
    warmS,
    firstTokenS: null,
    tokens: 0,
    totalS: 0,
    text: '',
    error: String(error).slice(0, 400),
  });
  let loadS = 0;
  let warmS: number | null = null;
  try {
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (r: InitProgressReport) =>
        log(`load ${Math.round(r.progress * 100)}% ${r.text.slice(0, 80)}`),
    });
    loadS = seconds(began);
    log(`loaded in ${loadS.toFixed(1)} s`);
    if (chunk > 0)
      log(
        `prefill chunk limit ${chunk}: applied to ${limitPrefillChunk(engine as never, chunk)} pipeline(s)`,
      );
    warmS = await warmUp(engine);
    log(`warm-up (shaders compiled) in ${warmS.toFixed(1)} s`);
    return { ok: true, loadS, warmS, ...(await generate(engine, promptWords)), error: null };
  } catch (error) {
    return failed(error, loadS, warmS);
  }
}

(globalThis as unknown as { gpuCheck: typeof check }).gpuCheck = check;
