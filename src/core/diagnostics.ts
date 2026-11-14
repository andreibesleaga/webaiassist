// SPDX-License-Identifier: Apache-2.0
// The text of "Copy diagnostics": what a person pastes into an issue. Only the fixed fields
// below can appear. Never page text, page titles, addresses, keys or tool results; the site host
// only when the caller passes one (the user ticked the box). The last error is cleaned: addresses
// and the endpoint key are replaced, and it is cut. Nothing here is sent anywhere.
export interface DiagnosticsFacts {
  readonly version: string;
  /** "Chrome/157.0.0.0". */
  readonly browser: string;
  readonly model?: string;
  /** Where the loaded model runs, in words ("in this browser, on the graphics card"). */
  readonly where?: string;
  readonly gpu?: {
    readonly vendor?: string;
    readonly architecture?: string;
    readonly shaderF16: boolean;
  };
  readonly builtIn?: string;
  /** "present, 3 tools", "not in this browser", "no page", "unknown". */
  readonly webmcp: string;
  readonly lastError?: string;
  /** The open site's host, set only when the user ticked the box. */
  readonly host?: string;
}

const ERROR_CAP = 300;
const FIELD_CAP = 120;
const MIN_SECRET = 4;

const oneLine = (text: string, cap = FIELD_CAP): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, cap);

/** An error text without addresses and keys, on one line, cut short. */
export function cleanError(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET) out = out.split(secret).join('[key]');
  }
  out = out.replace(/\bhttps?:\/\/\S+/gi, '[address]');
  out = out.replace(/\b(?:sk|pk|key|token)[-_][A-Za-z0-9_-]{12,}/gi, '[key]');
  return oneLine(out, ERROR_CAP);
}

function gpuLine(gpu: DiagnosticsFacts['gpu']): string {
  if (!gpu) return 'WebGPU: no adapter';
  const vendor = oneLine(gpu.vendor ?? 'unknown', 40);
  const architecture = oneLine(gpu.architecture ?? 'unknown', 40);
  return `WebGPU: adapter vendor ${vendor}, architecture ${architecture}; shader-f16 ${gpu.shaderF16 ? 'yes' : 'no'}`;
}

function modelLine(facts: DiagnosticsFacts): string {
  if (facts.model === undefined) return 'Model: not started';
  const where = facts.where === undefined ? '' : `, runs ${oneLine(facts.where)}`;
  return `Model: ${oneLine(facts.model)}${where}`;
}

/** The preview and the copy are this same text. */
export function diagnosticsText(facts: DiagnosticsFacts, secrets: readonly string[]): string {
  const lines = [
    'WebAIAssist diagnostics',
    `Extension: ${oneLine(facts.version, 30)}`,
    `Browser: ${oneLine(facts.browser, 60)}`,
    modelLine(facts),
    gpuLine(facts.gpu),
    `Chrome built-in model: ${oneLine(facts.builtIn ?? 'not checked', 40)}`,
    `WebMCP on the open tab: ${oneLine(facts.webmcp, 60)}`,
    `Last error: ${facts.lastError ? cleanError(facts.lastError, secrets) : 'none'}`,
  ];
  if (facts.host !== undefined) lines.push(`Site host: ${oneLine(facts.host, 100)}`);
  return lines.join('\n');
}
