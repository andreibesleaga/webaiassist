// SPDX-License-Identifier: Apache-2.0
// The ChatUI port in the side panel: the transcript, the streamed draft, the download
// progress and the two questions (run this tool? use this site's tools?).
import type { TranscriptEntry } from '../core/export';
import type { ChatUI, LoopEvent, ToolCallApproval } from '../core/ports/chat-ui';
import type { LoadProgress } from '../core/ports/model-runtime';
import type { SiteRequest } from '../core/site-consent';
import type { ToolInfo } from '../core/types';
import { ConfirmDialog } from './confirm-dialog';
import { againQuestion, needsSecondQuestion, toolQuestion } from './confirm-parts';
import { byId, element } from './dom';
import { t } from './i18n';
import { renderEntry } from './transcript-view';

export class PanelUI implements ChatUI {
  readonly entries: TranscriptEntry[] = [];
  private readonly dialog: ConfirmDialog;
  /** The tool whose "Run the tool?" question is open, if any. */
  private pending: string | undefined;
  private lastStatus = '';
  private lastTenth = -1;
  private lastFraction = 0;

  constructor(private readonly doc: Document) {
    this.dialog = new ConfirmDialog(doc);
  }

  addUser(text: string): void {
    this.add({ kind: 'user', text });
  }

  show(event: LoopEvent): void {
    if (event.kind === 'answer' || event.kind === 'tool-call') this.showDraft('');
    this.add(event);
  }

  showDraft(text: string): void {
    byId(this.doc, 'draft').textContent = text;
  }

  /** The bar follows every step; the status line (read aloud) changes once per ten percent. */
  showProgress(progress: LoadProgress): void {
    byId<HTMLProgressElement>(this.doc, 'progress').value = progress.fraction;
    const status = byId(this.doc, 'model-status');
    const tenth = Math.floor(progress.fraction * 10);
    // Only a step of real progress is held back; a message at 0 or 100 percent always shows.
    const sameStep =
      status.textContent === this.lastStatus &&
      tenth === this.lastTenth &&
      this.lastFraction > 0 &&
      progress.fraction >= this.lastFraction &&
      progress.fraction < 1;
    this.lastTenth = tenth;
    this.lastFraction = progress.fraction;
    if (sameStep) return;
    status.textContent = progress.text;
    this.lastStatus = progress.text;
  }

  /** Page text in the question (name, arguments) shows hidden characters as [U+XXXX]. */
  async confirmToolCall(request: ToolCallApproval): Promise<boolean> {
    this.pending = request.tool.name;
    try {
      if (!(await this.dialog.ask(toolQuestion(this.doc, request)))) return false;
      if (needsSecondQuestion(request.tool)) {
        if (!(await this.dialog.ask(againQuestion(this.doc, request.tool)))) return false;
      }
      this.noteForm(request.tool);
      return true;
    } finally {
      this.pending = undefined;
    }
  }

  /** A form tool without autosubmit: say in the transcript that the page waits for Submit. */
  private noteForm(tool: ToolInfo): void {
    if (tool.form && !tool.form.autosubmit) this.add({ kind: 'note', text: t('formWaitNote') });
  }

  /** The name of the tool whose question is open, or undefined. */
  pendingToolName(): string | undefined {
    return this.pending;
  }

  /** Clears the conversation (a different site's chat is about to be shown). */
  reset(): void {
    this.entries.length = 0;
    byId(this.doc, 'transcript').replaceChildren();
    this.showDraft('');
    this.syncEmpty();
  }

  /** Shows saved lines without running anything. */
  restore(entries: readonly TranscriptEntry[]): void {
    for (const entry of entries) this.add(entry);
    this.syncEmpty();
  }

  /** The line shown while the conversation has no entry. */
  setEmptyText(text: string): void {
    byId(this.doc, 'chat-empty').textContent = text;
    this.syncEmpty();
  }

  /** Questions offered in the empty chat; a click fills the question box and sends nothing. */
  setStarters(prompts: readonly string[]): void {
    const list = byId(this.doc, 'starter-prompts');
    list.replaceChildren(
      ...prompts.map((prompt) => {
        const item = element(this.doc, 'li');
        const button = element(this.doc, 'button', prompt);
        button.type = 'button';
        button.addEventListener('click', () => this.fillQuestion(prompt));
        item.append(button);
        return item;
      }),
    );
    this.syncEmpty();
  }

  private fillQuestion(prompt: string): void {
    const box = byId<HTMLTextAreaElement>(this.doc, 'question');
    box.value = prompt;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
  }

  private syncEmpty(): void {
    byId(this.doc, 'chat-empty').hidden = this.entries.length > 0;
    const starters = byId(this.doc, 'starter-prompts');
    starters.hidden = this.entries.length > 0 || starters.childElementCount === 0;
  }

  confirmSite(request: SiteRequest): Promise<boolean> {
    return this.dialog.ask({
      title: t('siteTitle', { origin: request.origin }),
      body: [element(this.doc, 'p', t('siteBody', { count: request.toolCount }))],
      allowLabel: t('allowSite'),
      denyLabel: t('deny'),
    });
  }

  /** Answers an open question with Deny (used by Stop). */
  cancelDialog(): void {
    this.dialog.cancel();
  }

  /** An error the same as the entry just before it is not shown again. */
  private add(entry: TranscriptEntry): void {
    const last = this.entries.at(-1);
    if (entry.kind === 'error' && last?.kind === 'error' && last.text === entry.text) return;
    this.entries.push(entry);
    const list = byId(this.doc, 'transcript');
    const item = renderEntry(this.doc, entry);
    list.append(item);
    this.syncEmpty();
    item.scrollIntoView?.({ block: 'end' });
  }
}
