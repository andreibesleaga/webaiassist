// SPDX-License-Identifier: Apache-2.0
// Checks every message that arrives from another part of the extension or the page.
// Uses the pre-compiled Ajv validators, which need no eval (see scripts/gen-validators.ts).
import { HOPS, type Hop, type Message, type MessageType, type PageEnvelope } from './messages';
import * as generated from './validators.generated.js';
import type { StandaloneValidator } from './validators.generated.js';

export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

const VALIDATORS: Record<MessageType, StandaloneValidator> = {
  'tools/list': generated.validate_tools_list,
  'tools/list-result': generated.validate_tools_list_result,
  'tools/call': generated.validate_tools_call,
  'tools/call-result': generated.validate_tools_call_result,
  'tools/changed': generated.validate_tools_changed,
  'model/load': generated.validate_model_load,
  'model/progress': generated.validate_model_progress,
  'model/load-result': generated.validate_model_load_result,
  'model/stop': generated.validate_model_stop,
  'model/cancel': generated.validate_model_cancel,
  'model/chat': generated.validate_model_chat,
  'model/token': generated.validate_model_token,
  'model/chat-result': generated.validate_model_chat_result,
  'probe/gpu': generated.validate_probe_gpu,
  'probe/gpu-result': generated.validate_probe_gpu_result,
  'site/file': generated.validate_site_file,
  'site/page': generated.validate_site_page,
};

function typeOf(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const type = (raw as { type?: unknown }).type;
  return typeof type === 'string' ? type : undefined;
}

function allowed(hop: Hop, type: string): type is MessageType {
  return (HOPS[hop] as readonly string[]).includes(type);
}

function check<T>(validate: StandaloneValidator, raw: unknown): ParseOutcome<T> {
  if (validate(raw)) return { ok: true, value: raw as T };
  const first = validate.errors?.[0];
  return {
    ok: false,
    error: `${first?.instancePath || '(message)'} ${first?.message ?? 'is not valid'}`,
  };
}

/** The message if it is valid and allowed on this hop; otherwise why not. */
export function parseMessage(raw: unknown, hop: Hop): ParseOutcome<Message> {
  const type = typeOf(raw);
  if (type === undefined) return { ok: false, error: 'not a message' };
  if (!allowed(hop, type)) {
    return { ok: false, error: `message type "${type}" is not allowed on the ${hop} hop` };
  }
  return check<Message>(VALIDATORS[type], raw);
}

/** The page-hop wrapper; its `message` is then checked with parseMessage(..., 'page'). */
export function parseEnvelope(raw: unknown): ParseOutcome<PageEnvelope> {
  return check<PageEnvelope>(generated.validate_envelope, raw);
}
