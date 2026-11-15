// SPDX-License-Identifier: Apache-2.0
// The side panel's part of the activity log: watches one question (the model, the confirmation
// and the tool events, through the wrappers in src/core/activity-wrap.ts) and writes one entry
// when it ends. A failed write shows one line and never touches the answer.
import { isLocalEndpoint } from '../adapters/endpoint-runtime';
import { QuestionTrace } from '../core/activity-trace';
import { traceModel, traceUi } from '../core/activity-wrap';
import type { AgentDeps, AgentInput, AgentResult } from '../core/agent-loop';
import type { ActivityLog, PlaceKind } from '../core/ports/activity-log';
import type { ChatUI } from '../core/ports/chat-ui';
import type { Memory } from '../core/ports/memory';
import type { ModelRuntime } from '../core/ports/model-runtime';
import { endpointHost } from './endpoint-host';
import { t } from './i18n';
import { note } from './panel-note';
import type { PanelController } from './panel-controller';

interface Parts {
  readonly model: ModelRuntime;
  readonly memory: Memory;
  readonly ui: ChatUI;
}

export interface ActivityRun {
  /** The same parts with the model and the chat surface watched. */
  wrap(parts: Parts): Parts;
  /** `run` that writes the entry when the question ends, whichever way, and returns the result
   *  unchanged. */
  watched(run: AgentRun): AgentRun;
}

type AgentRun = (deps: AgentDeps, input: AgentInput) => Promise<AgentResult>;

const NOT_WATCHED: ActivityRun = { wrap: (parts) => parts, watched: (run) => run };

/** Where the model that is loaded runs. */
function placeOf(ctx: PanelController, model: ModelRuntime): PlaceKind {
  const { settings, runtime, choices } = ctx.state;
  const runs = choices.find((c) => c.label === runtime?.label)?.runtime;
  if (runs === 'endpoint') return isLocalEndpoint(settings.endpoint.url) ? 'own-server' : 'remote';
  if (runs === 'prompt-api') return 'chrome';
  const cpu = runs === 'cpu' || model.where?.()?.startsWith('cpu:') === true;
  return cpu ? 'cpu' : 'gpu';
}

async function newTrace(
  ctx: PanelController,
  model: ModelRuntime,
  question: { origin: string; text: string },
  log: ActivityLog,
): Promise<QuestionTrace> {
  const place = placeOf(ctx, model);
  const { apiKey, url } = ctx.state.settings.endpoint;
  return new QuestionTrace(
    {
      origin: question.origin,
      model: ctx.state.runtime?.label ?? '',
      place,
      ...(place === 'remote' || place === 'own-server' ? { host: endpointHost(url) } : {}),
      windowTokens: model.capabilities().contextTokens,
      text: question.text,
      includeContent: await log.includeContent().catch(() => false),
      secrets: apiKey === '' ? [] : [apiKey],
    },
    { nowMs: () => ctx.deps.nowMs(), nowIso: () => ctx.deps.clock.nowIso() },
    () => globalThis.crypto.randomUUID(),
  );
}

type Save = (end: Parameters<QuestionTrace['build']>[0]) => Promise<void>;

/** `run` that saves the entry when the question ends, whichever way. */
function watching(run: AgentRun, trace: QuestionTrace, save: Save, signal: AbortSignal): AgentRun {
  return async (deps, input) => {
    try {
      const result = await run(deps, input);
      await save({
        status: result.status,
        steps: result.steps,
        ...(result.error === undefined ? {} : { error: result.error }),
      });
      return result;
    } catch (error) {
      await save({
        status: signal.aborted ? 'stopped' : 'failed',
        steps: trace.modelCalls,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export async function startActivity(
  ctx: PanelController,
  origin: string,
  text: string,
  signal: AbortSignal,
): Promise<ActivityRun> {
  const log = ctx.deps.activity;
  const model = ctx.state.runtime?.model;
  // "Remember chats ... Turn off to keep nothing": the log is part of what is kept.
  if (!log || !model || !ctx.state.settings.memory) return NOT_WATCHED;
  const trace = await newTrace(ctx, model, { origin, text }, log);
  const save: Save = async (end) => {
    try {
      await log.append(trace.build(end));
    } catch {
      note(ctx, t('activityNotSaved'));
    }
  };
  return {
    wrap: (parts) => ({
      ...parts,
      model: traceModel(parts.model, trace),
      ui: traceUi(parts.ui, trace),
    }),
    watched: (run) => watching(run, trace, save, signal),
  };
}

export interface HandRun {
  /** The chat surface, watched: the question, the answer and the result of the one call. */
  readonly ui: ChatUI;
  /** Writes the entry; `error` is the text of the failure when the run failed. */
  done(error?: string): Promise<void>;
}

/** The entry of a tool run by hand (panel-manual-run.ts): no model, one tool call, the same
 *  rules for content and secrets as a question. Nothing is kept when memory is off. */
export async function startHandActivity(ctx: PanelController, origin: string): Promise<HandRun> {
  const log = ctx.deps.activity;
  if (!log || !ctx.state.settings.memory) return { ui: ctx.ui, done: () => Promise.resolve() };
  const { apiKey } = ctx.state.settings.endpoint;
  const trace = new QuestionTrace(
    {
      origin,
      model: t('activityByHand'),
      place: 'by-hand',
      windowTokens: 0,
      text: '',
      includeContent: await log.includeContent().catch(() => false),
      secrets: apiKey === '' ? [] : [apiKey],
    },
    { nowMs: () => ctx.deps.nowMs(), nowIso: () => ctx.deps.clock.nowIso() },
    () => globalThis.crypto.randomUUID(),
  );
  return {
    ui: traceUi(ctx.ui, trace),
    done: async (error) => {
      const failed = error === undefined ? {} : { error };
      const status = error === undefined ? 'answered' : 'failed';
      try {
        await log.append(trace.build({ status, steps: 0, ...failed }));
      } catch {
        note(ctx, t('activityNotSaved'));
      }
    },
  };
}
