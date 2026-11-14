// SPDX-License-Identifier: Apache-2.0
// Checks the model's reply before anything runs: valid action, a listed tool, arguments that
// fit the tool's schema. A reply that fails gets one repair turn (see REPAIR) and then ends
// the run with `final`, the message the user sees.
import { parseAction } from './action';
import type { ArgsValidator } from './ports/args-validator';
import { cleanPageText, quoteName } from './sanitize';
import { describeArguments } from './tool-signature';
import type { ToolArgs, ToolInfo } from './types';

export type Checked =
  | { readonly ok: true; readonly kind: 'answer'; readonly text: string }
  | { readonly ok: true; readonly kind: 'call'; readonly tool: ToolInfo; readonly args: ToolArgs }
  | { readonly ok: false; readonly reason: string; readonly final?: string };

export const REPAIR =
  'Your last reply was not a valid action: %s. Reply with one JSON object: ' +
  '{"tool": "<name>", "arguments": {...}} or {"answer": "<text>"}.';
/** Validator messages quoted in a repair turn: path and keyword only, a few, short. */
const MAX_QUOTED_ERRORS = 5;
const QUOTED_ERROR_CAP = 120;

/** Validator messages as quoted to the model: cleaned, capped, at most a few. */
function quotedErrors(errors: readonly string[]): string {
  return errors
    .slice(0, MAX_QUOTED_ERRORS)
    .map((error) => cleanPageText(error).slice(0, QUOTED_ERROR_CAP))
    .join('; ');
}

function badArguments(tool: ToolInfo, errors: readonly string[]): Checked {
  const name = quoteName(tool.name);
  const takes = describeArguments(tool);
  return {
    ok: false,
    reason: `the arguments do not match the schema: ${quotedErrors(errors)}. "${name}" takes: ${takes}`,
    final: `The model could not fill in the arguments for ${name}. It takes: ${takes}.`,
  };
}

export function checkAction(
  reply: string,
  tools: readonly ToolInfo[],
  validator: ArgsValidator,
): Checked {
  const parsed = parseAction(reply);
  if (!parsed.ok) return parsed;
  const action = parsed.action;
  if (action.kind === 'answer') return { ok: true, kind: 'answer', text: action.text };
  const tool = tools.find((t) => t.name === action.tool);
  if (!tool) return { ok: false, reason: `unknown tool "${quoteName(action.tool)}"` };
  const result = validator.validate(tool.inputSchema ?? { type: 'object' }, action.args);
  if (!result.ok) return badArguments(tool, result.errors);
  return { ok: true, kind: 'call', tool, args: action.args };
}
