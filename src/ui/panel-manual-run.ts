// SPDX-License-Identifier: Apache-2.0
// Run a tool by hand: the "Run…" button of the tool detail view. It uses the same steps as a call
// the model asks for (core runTool): the question about the site, the check that the tool is
// unchanged, the question about the call (always asked, in every mode), the call, and the result
// shown as the page's. No model is involved. The arguments are checked against the tool's own
// fields before anything is asked.
import { runTool, type LoopState, type RunScope, type ToolDeps } from '../core/tool-step';
import type { ToolArgs, ToolInfo } from '../core/types';
import { t } from './i18n';
import type { PanelController } from './panel-controller';
import { setRunning, siteQuestion } from './panel-run';
import { shownText } from './panel-problems';

type Say = (line: string) => void;

const EMPTY_OBJECT_SCHEMA = { type: 'object' };

/** The arguments as an object, or the plain sentence that says what is wrong. */
export function parseArgs(
  ctx: PanelController,
  tool: ToolInfo,
  text: string,
): { args: ToolArgs } | { problem: string } {
  let value: unknown;
  try {
    value = JSON.parse(text.trim() === '' ? '{}' : text);
  } catch {
    return { problem: t('runNotJson') };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { problem: t('runNotObject') };
  }
  const checked = ctx.deps.validator.validate(tool.inputSchema ?? EMPTY_OBJECT_SCHEMA, value);
  if (!checked.ok) return { problem: t('runInvalid', { message: checked.errors.join('; ') }) };
  return { args: value as ToolArgs };
}

function freshState(tool: ToolInfo): LoopState {
  return {
    messages: [],
    tools: [tool],
    steps: 0,
    repairUsed: false,
    denied: new Set(),
    made: new Map(),
    repeats: 0,
    history: { count: 0 },
    largestResult: 0,
    transient: new Set(),
  };
}

async function execute(ctx: PanelController, tool: ToolInfo, args: ToolArgs): Promise<void> {
  const page = ctx.state.page;
  const info = page?.info;
  if (page === undefined || info === undefined) return;
  const origin = info.origin;
  const controller = new AbortController();
  setRunning(ctx, controller);
  Object.assign(ctx.state, { runOrigin: origin, stoppedBySwitch: false, pageChangedTo: undefined });
  const settings = await ctx.deps.loadSettings();
  const deps: ToolDeps = {
    bridge: ctx.deps.bridge,
    memory: await ctx.deps.memory(settings),
    ui: ctx.ui,
    clock: ctx.deps.clock,
    validator: ctx.deps.validator,
    ledger: ctx.state.ledger,
    siteGate: siteQuestion(ctx, origin, info.tools.length),
  };
  const scope: RunScope = {
    tabId: page.tabId,
    origin,
    signal: controller.signal,
    confirmEveryCall: true,
    manual: true,
  };
  const state = freshState(tool);
  await runTool(deps, scope, state, { tool, args });
  if (state.movedTo !== undefined) {
    ctx.ui.show({ kind: 'note', text: t('runMoved', { origin: state.movedTo }) });
  }
}

/** The user pressed "Run…" in the detail view of `tool`; `say` writes a line under the box. */
export function runByHand(ctx: PanelController, tool: ToolInfo, text: string, say: Say): void {
  say('');
  if (ctx.state.running) return say(t('runBusy'));
  if (ctx.state.page?.info === undefined) return say(t('runNoPage'));
  const parsed = parseArgs(ctx, tool, text);
  if ('problem' in parsed) return say(parsed.problem);
  void execute(ctx, tool, parsed.args)
    .catch((error: unknown) => ctx.ui.show({ kind: 'error', text: shownText(error) }))
    .finally(() => setRunning(ctx, undefined));
}
