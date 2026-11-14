// SPDX-License-Identifier: Apache-2.0
// The spike page: checks WebGPU (here, in the service worker and in the offscreen
// document), Chrome's Prompt API and the WebMCP registry, then prints a report to copy.
import fixture from '../../fixtures/agsc-tools.json';
import { probePromptApi, type LanguageModelLike } from '../adapters/prompt-api-probe';
import { probeWebGpu } from '../adapters/webgpu-probe';
import type { GpuReport } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import { formatReport, gpuRows, promptRows, type Section } from '../spike/report';
import { webmcpSection } from '../spike/webmcp-check';

const inExtension = (): boolean => typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

function environment(): Section {
  const brands = (
    navigator as { userAgentData?: { brands?: { brand: string; version: string }[] } }
  ).userAgentData?.brands;
  return {
    title: 'Browser',
    rows: [
      ['user agent', navigator.userAgent],
      ['brands', brands?.map((b) => `${b.brand} ${b.version}`).join(', ') ?? '-'],
      ['page', `${location.protocol}//${location.host}`],
      ['secure context', String(window.isSecureContext)],
      ['opened from the extension', String(inExtension())],
    ],
  };
}

async function hostGpu(target: 'worker' | 'offscreen'): Promise<Section> {
  const title = `WebGPU (${target === 'worker' ? 'service worker' : 'offscreen document'})`;
  if (!inExtension()) return { title, rows: [['skipped', 'open this page from the extension']] };
  const reply: unknown = await chrome.runtime.sendMessage({
    type: 'probe/gpu',
    id: `p-${target}`,
    target,
  });
  const parsed = parseMessage(reply, 'panel');
  if (!parsed.ok || parsed.value.type !== 'probe/gpu-result') {
    return { title, rows: [['error', parsed.ok ? 'unexpected reply' : parsed.error]] };
  }
  return { title, rows: gpuRows(parsed.value.report) };
}

async function collect(): Promise<Section[]> {
  const page: GpuReport = await probeWebGpu(navigator.gpu);
  const lm = (globalThis as { LanguageModel?: LanguageModelLike }).LanguageModel;
  return [
    environment(),
    { title: 'WebGPU (this page)', rows: gpuRows(page) },
    await hostGpu('worker'),
    await hostGpu('offscreen'),
    { title: 'Prompt API', rows: promptRows(await probePromptApi(lm)) },
    await webmcpSection(document, navigator, fixture.tools),
  ];
}

function show(text: string): void {
  const out = document.getElementById('report');
  const copy = document.getElementById('copy') as HTMLButtonElement | null;
  if (out) out.textContent = text;
  if (copy) copy.disabled = false;
}

document.getElementById('run')?.addEventListener('click', () => {
  show('Running...');
  collect()
    .then((sections) => show(formatReport(sections, new Date().toISOString())))
    .catch((error: unknown) => show(`The spike failed: ${String(error)}`));
});

document.getElementById('copy')?.addEventListener('click', () => {
  const text = document.getElementById('report')?.textContent ?? '';
  void navigator.clipboard.writeText(text);
});
