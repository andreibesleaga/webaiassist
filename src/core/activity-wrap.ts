// SPDX-License-Identifier: Apache-2.0
// Two thin wrappers that let the activity log watch a question without a change in the agent loop:
// the model (every chat call, its first word, its usage) and the chat surface (the confirmation
// question and the loop's tool events). Each passes everything on unchanged.
import type { QuestionTrace } from './activity-trace';
import type { ChatUI } from './ports/chat-ui';
import type { ChatRequest, ModelRuntime } from './ports/model-runtime';

export function traceModel(model: ModelRuntime, trace: QuestionTrace): ModelRuntime {
  return {
    load: (id, onProgress, signal) => model.load(id, onProgress, signal),
    unload: () => model.unload(),
    capabilities: () => model.capabilities(),
    where: () => model.where?.(),
    async chat(request: ChatRequest): Promise<string> {
      const call = trace.beginCall(request.messages);
      try {
        const reply = await model.chat({
          ...request,
          onToken: (token) => {
            call.token();
            request.onToken?.(token);
          },
          onUsage: (usage) => {
            call.usage(usage);
            request.onUsage?.(usage);
          },
        });
        call.end(reply);
        return reply;
      } catch (error) {
        call.fail();
        throw error;
      }
    },
  };
}

export function traceUi(ui: ChatUI, trace: QuestionTrace): ChatUI {
  return {
    show(event) {
      if (event.kind === 'tool-call') trace.toolStarted(event.name, event.args);
      else if (event.kind === 'tool-result') trace.toolFinished(event.name, event.ok, event.text);
      else if (event.kind === 'tool-denied') trace.toolDenied(event.name);
      ui.show(event);
    },
    async confirmToolCall(request) {
      trace.toolAsked(request.tool.name, request.args);
      const allowed = await ui.confirmToolCall(request);
      trace.toolAnswered(allowed);
      return allowed;
    },
    showDraft: (text) => ui.showDraft(text),
    showProgress: (progress) => ui.showProgress(progress),
  };
}
