// SPDX-License-Identifier: Apache-2.0
// The "Run again" button of a past tool call in the Activity tab. The button is drawn only where a
// re-run can work: the call has saved arguments, it is a tool of the page, and the page was opened
// for the same site. A press asks the side panel's question (src/ui/confirm-parts.ts: site, review,
// hint, form lines, full arguments with hidden characters made visible, and a second question for
// a tool the page marks as consequential) and runs nothing before Allow. The site question is
// not asked here: a site not yet allowed in this session is refused with a sentence that sends
// the user to the side panel. The rest is rerunToolCall (src/core/activity-rerun.ts).
import type { ToolCallApproval } from '../../core/ports/chat-ui';
import { rerunToolCall, type RerunResult } from '../../core/activity-rerun';
import type { QuestionRecord, ToolCall } from '../../core/ports/activity-log';
import { revealInvisible } from '../../core/sanitize';
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';
import { againQuestion, needsSecondQuestion, toolQuestion } from '../confirm-parts';
import type { Question } from '../confirm-dialog';
import { createAsker } from './activity-ask';
import type { ActivityDeps } from './activity-tab';

const SHOWN = 2000;

const REFUSED: Record<Exclude<RerunResult['state'], 'ran'>, MessageKey> = {
  denied: 'activityRerunDenied',
  'site-not-allowed': 'activityRerunSite',
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
  const { target, bridge, grants } = deps;
  if (!target || !bridge || !grants || call.builtin || call.args === undefined) return undefined;
  if (record.origin !== target.origin) return undefined;
  const button = element(doc, 'button', t('activityRerun'));
  button.type = 'button';
  const ask = createAsker(doc, askHost);
  const askQuestion = (question: Question): Promise<boolean> =>
    ask({
      text: question.title,
      body: question.body,
      yes: question.allowLabel,
      no: question.denyLabel,
    });
  const confirm = async (request: ToolCallApproval): Promise<boolean> => {
    const first = toolQuestion(
      doc,
      request,
      t('activityRerunAsk', { name: revealInvisible(request.tool.name) }),
    );
    if (!(await askQuestion(first))) return false;
    return !needsSecondQuestion(request.tool) || askQuestion(againQuestion(doc, request.tool));
  };
  button.addEventListener('click', () => {
    void rerunToolCall({ bridge, grants, confirm }, target, call).then((result) => {
      out.textContent = resultText(call.name, result);
    });
  });
  return button;
}
