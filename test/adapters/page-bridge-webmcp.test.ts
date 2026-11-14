// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { startMainBridge } from '../../src/adapters/page-bridge-main';
import type { ModelContextLike } from '../../src/adapters/webmcp-reader';
import { FakeModelContext, FakeWindow, settle } from './bridge-bus';

const CHANNEL = 'c0ffee00-1234-4abc-8def-0123456789ab';
const ORIGIN = 'https://node.example';

async function list(context: ModelContextLike | undefined, id: string) {
  const win = new FakeWindow(ORIGIN);
  startMainBridge(win, () => context);
  win.postMessage(
    { source: 'webaiassist', channel: CHANNEL, message: { type: 'tools/list', id } },
    '*',
  );
  await settle();
  const posted = win.posted as { message?: Record<string, unknown> }[];
  return posted.filter((p) => p.message?.type === 'tools/list-result').at(-1)?.message;
}

describe('startMainBridge: the WebMCP interface flag', () => {
  it('says whether the page has a WebMCP interface at all, apart from its tools', async () => {
    const withApi = await list(new FakeModelContext(ORIGIN, []), 'w1');
    expect(withApi).toMatchObject({ ok: true, tools: [], webmcp: true });
    const without = await list(undefined, 'w2');
    expect(without).toMatchObject({ ok: true, tools: [], webmcp: false });
  });
});
