// SPDX-License-Identifier: Apache-2.0
// Builds the ModelRuntime for the choice in the side panel. The models in the browser run in
// the offscreen document, reached through a port (the graphics-card ones only when the WebGPU
// probe finds an adapter there); Chrome's built-in model and an endpoint run from the panel
// itself.
import { EndpointRuntime } from '../../adapters/endpoint-runtime';
import { chooseHost, type HostTarget } from '../../adapters/host-choice';
import { MODEL_PORT_PREFIX } from '../../adapters/model-host';
import { CPU_CAPABILITIES } from '../../adapters/cpu-models';
import { PortModelRuntime } from '../../adapters/port-model-runtime';
import { PromptApiRuntime, type LanguageModelStatic } from '../../adapters/prompt-api-runtime';
import type { Settings } from '../../adapters/settings';
import type { ModelRuntime } from '../../core/ports/model-runtime';
import { ScriptedModelRuntime } from '../../fakes/scripted-model-runtime';
import type { GpuReport } from '../../protocol/messages';
import { parseMessage } from '../../protocol/validate';
import { t } from '../../ui/i18n';
import type { PickerChoice } from '../../ui/model-picker';
import type { HostName } from '../../ui/panel-controller';
import { NoGpuError } from '../../ui/problems';

async function probe(target: HostTarget): Promise<GpuReport> {
  const reply: unknown = await chrome.runtime.sendMessage({
    type: 'probe/gpu',
    id: crypto.randomUUID(),
    target,
  });
  const parsed = parseMessage(reply, 'panel');
  if (parsed.ok && parsed.value.type === 'probe/gpu-result') return parsed.value.report;
  throw new Error(parsed.ok ? 'unexpected reply' : parsed.error);
}

/** The scripted test model exists only in the smoke-test build; the release build drops it. */
const scripted = __WEBAIASSIST_SMOKE__
  ? (): Promise<{ runtime: ModelRuntime }> =>
      Promise.resolve({ runtime: new ScriptedModelRuntime() })
  : (): Promise<{ runtime: ModelRuntime }> =>
      Promise.reject(new Error('The scripted model is only in the smoke-test build.'));

async function webllm(): Promise<{ runtime: ModelRuntime; host: HostName }> {
  const choice = await chooseHost(probe);
  if (choice.host === 'none') throw new NoGpuError(t('noGpu', { why: choice.notes.join('; ') }));
  const name = `${MODEL_PORT_PREFIX}${choice.host}`;
  const runtime = new PortModelRuntime(
    () => chrome.runtime.connect({ name }),
    () => crypto.randomUUID(),
    CPU_CAPABILITIES,
  );
  return { runtime, host: choice.host };
}

/** The processor model runs in the offscreen document: the probe opens it (its WebGPU answer is
 *  not used here), then the port connects to the host named "cpu". */
async function cpu(): Promise<{ runtime: ModelRuntime; host: HostName }> {
  await probe('offscreen').catch(() => undefined);
  const runtime = new PortModelRuntime(
    () => chrome.runtime.connect({ name: `${MODEL_PORT_PREFIX}cpu` }),
    () => crypto.randomUUID(),
    CPU_CAPABILITIES,
  );
  return { runtime, host: 'cpu' };
}

export async function createRuntime(
  choice: PickerChoice,
  settings: Settings,
): Promise<{ runtime: ModelRuntime; host?: HostName }> {
  switch (choice.runtime) {
    case 'webllm':
      return webllm();
    case 'cpu':
      return cpu();
    case 'prompt-api': {
      const lm = (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
      return { runtime: new PromptApiRuntime(lm) };
    }
    case 'endpoint':
      return { runtime: new EndpointRuntime(settings.endpoint, (url, init) => fetch(url, init)) };
    case 'scripted':
      return scripted();
    case 'setup':
      // The panel opens Options for this choice and never asks for a runtime.
      return Promise.reject(new Error('Set up a chat endpoint in Options first.'));
  }
}
