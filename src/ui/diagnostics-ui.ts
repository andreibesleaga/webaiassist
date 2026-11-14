// SPDX-License-Identifier: Apache-2.0
// The "Copy diagnostics" button of the panel and of the Options page. First click: a preview of
// exactly what would be copied. Second click: copies that text. Ticking the host box (panel
// only) changes the preview. Nothing is sent anywhere; the text is built in src/core/diagnostics.ts.
import { diagnosticsText, type DiagnosticsFacts } from '../core/diagnostics';
import { byId } from './dom';
import { t } from './i18n';

export interface DiagnosticsDeps {
  readonly doc: Document;
  /** The facts; `includeHost` is the state of the box (always false where there is no box). */
  gather(includeHost: boolean): Promise<DiagnosticsFacts>;
  /** Strings that must never appear (the endpoint key). */
  secrets(): readonly string[];
  copy(text: string): Promise<void>;
  /** Where the result is told (the panel's note, the Options status line). */
  say(text: string): void;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function bindDiagnostics(deps: DiagnosticsDeps): void {
  const { doc } = deps;
  const button = byId<HTMLButtonElement>(doc, 'diagnostics');
  const box = byId(doc, 'diag-box');
  const preview = byId(doc, 'diag-preview');
  const host = doc.getElementById('diag-host') as HTMLInputElement | null;
  const idle = button.textContent;

  const show = async (): Promise<void> => {
    const facts = await deps.gather(host?.checked === true);
    preview.textContent = diagnosticsText(facts, deps.secrets());
    box.hidden = false;
    button.textContent = t('diagnosticsCopy');
  };
  const copy = async (): Promise<void> => {
    await deps.copy(preview.textContent);
    deps.say(t('diagnosticsCopied'));
    box.hidden = true;
    button.textContent = idle;
  };
  button.addEventListener('click', () => {
    const next = box.hidden ? show() : copy();
    next.catch((error: unknown) => deps.say(t('diagnosticsFailed', { why: message(error) })));
  });
  host?.addEventListener('change', () => void show());
}
