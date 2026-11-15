// SPDX-License-Identifier: Apache-2.0
// The "Run again" button of a past tool call in the Activity tab. The button is drawn only where a
// re-run can work: the call has saved arguments, it is a tool of the page, and the page was opened
// for the same site. A press asks through the page's own question (Allow / Deny) and runs nothing
// before Allow; the rest is rerunToolCall (src/core/activity-rerun.ts).
import { rerunToolCall, type RerunResult } from '../../core/activity-rerun';
import type { QuestionRecord, ToolCall } from '../../core/ports/activity-log';
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';
import { createAsker } from './activity-ask';
import type { ActivityDeps } from './activity-tab';

const SHOWN = 2000;
const ARGS_SHOWN = 300;

const REFUSED: Record<Exclude<RerunResult['state'], 'ran'>, MessageKey> = {
  denied: 'activityRerunDenied',
  'no-arguments': 'activityRerunNoArgs',
  'other-site': 'activityRerunOtherSite',
  'tool-missing': 'activityRerunMissing',
  'tool-changed': 'activityRerunChanged',
};

function resultText(name: string, result: RerunResult): string {
  if (result.state !== 'ran') return t(REFUSED[result.state]);
  const text = result.text.slice(0, SHOWN);
  return t(result.ok ? 'activityRerunResult' : 'activityRerunFailed', { name, text });
}

/** The button for `call`, or undefined where a re-run cannot work. */
export interface RerunPlace {
  readonly doc: Document;
  readonly deps: ActivityDeps;
  /** Where the question is shown, and where the result is written. */
  readonly askHost: HTMLElement;
  readonly out: HTMLElement;
}

export function rerunButton(
  place: RerunPlace,
  record: QuestionRecord,
  call: ToolCall,
): HTMLButtonElement | undefined {
  const { doc, deps, askHost, out } = place;
  const { target, bridge } = deps;
  if (!target || !bridge || call.builtin || call.args === undefined) return undefined;
  if (record.origin !== target.origin) return undefined;
  const button = element(doc, 'button', t('activityRerun'));
  button.type = 'button';
  const ask = createAsker(doc, askHost);
  const confirm = (request: { tool: { name: string }; args: unknown; origin: string }) =>
    ask({
      text: t('activityRerunAsk', {
        name: request.tool.name,
        host: new URL(request.origin).host,
        args: JSON.stringify(request.args).slice(0, ARGS_SHOWN),
      }),
      yes: t('activityRerunAllow'),
      no: t('activityRerunDeny'),
    });
  button.addEventListener('click', () => {
    void rerunToolCall({ bridge, confirm }, target, call).then((result) => {
      out.textContent = resultText(call.name, result);
    });
  });
  return button;
}
