// SPDX-License-Identifier: Apache-2.0
import type { ChatUI, LoopEvent, ToolCallApproval } from '../core/ports/chat-ui';
import type { LoadProgress } from '../core/ports/model-runtime';

/** Records what the loop shows and answers every confirmation with a fixed choice. */
export class FakeChatUI implements ChatUI {
  readonly events: LoopEvent[] = [];
  readonly approvals: ToolCallApproval[] = [];
  readonly progress: LoadProgress[] = [];
  readonly drafts: string[] = [];

  constructor(private readonly allow: boolean = true) {}

  show(event: LoopEvent): void {
    this.events.push(event);
  }

  confirmToolCall(request: ToolCallApproval): Promise<boolean> {
    this.approvals.push(request);
    return Promise.resolve(this.allow);
  }

  showDraft(text: string): void {
    this.drafts.push(text);
  }

  showProgress(progress: LoadProgress): void {
    this.progress.push(progress);
  }
}
