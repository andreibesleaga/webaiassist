// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: the sender checks of the service worker, the
// offscreen document and the model hosts, run on the real entry code with a stub `chrome`.
// A failing test here is an open finding of the review (see the report), not a broken test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/entries/shared/webllm-factory', () => ({
  createWebLlmEngine: () => Promise.reject(new Error('no engine in tests')),
}));
vi.mock('../../src/entries/shared/cpu-engine', () => ({
  cpuEngine: () => {
    throw new Error('no engine in tests');
  },
  cpuTestModels: [],
}));

type Listener = (raw: unknown, sender: unknown, respond: (reply: unknown) => void) => boolean;
type ConnectListener = (port: unknown) => void;

const EXT = 'abcdefghijklmnopabcdefghijklmnop';
const BASE = `chrome-extension://${EXT}/`;
const PANEL = { id: EXT, url: `${BASE}sidepanel.html` };
const CONTENT = { id: EXT, url: 'https://evil.example/shop', tab: { id: 5 }, frameId: 0 };

interface Stub {
  readonly messageListeners: Listener[];
  readonly connectListeners: ConnectListener[];
  readonly tabMessages: unknown[];
  readonly setAccessLevel: ReturnType<typeof vi.fn>;
}

function stubChrome(): Stub {
  const stub: Stub = {
    messageListeners: [],
    connectListeners: [],
    tabMessages: [],
    setAccessLevel: vi.fn(() => Promise.resolve()),
  };
  vi.stubGlobal('chrome', {
    runtime: {
      id: EXT,
      getURL: (path: string) => `${BASE}${path}`,
      onMessage: { addListener: (l: Listener) => stub.messageListeners.push(l) },
      onInstalled: { addListener: () => undefined },
      onStartup: { addListener: () => undefined },
      onConnect: { addListener: (l: ConnectListener) => stub.connectListeners.push(l) },
      sendMessage: () => Promise.resolve(undefined),
    },
    permissions: { onRemoved: { addListener: () => undefined } },
    tabs: {
      onUpdated: { addListener: () => undefined },
      onActivated: { addListener: () => undefined },
      sendMessage: (_tab: number, message: unknown) => {
        stub.tabMessages.push(message);
        return Promise.resolve(undefined);
      },
    },
    scripting: { executeScript: () => Promise.resolve([]) },
    sidePanel: { setPanelBehavior: () => Promise.resolve() },
    storage: {
      local: { setAccessLevel: stub.setAccessLevel },
      session: { setAccessLevel: stub.setAccessLevel },
    },
  });
  return stub;
}

function fakePort(name: string, sender: unknown) {
  const listened: unknown[] = [];
  return {
    port: {
      name,
      sender,
      postMessage: () => undefined,
      disconnect: () => undefined,
      onMessage: { addListener: (l: unknown) => listened.push(l) },
      onDisconnect: { addListener: () => undefined },
    },
    listened,
  };
}

let stub: Stub;
beforeEach(() => {
  vi.resetModules();
  stub = stubChrome();
});
afterEach(() => vi.unstubAllGlobals());

const listRequest = { type: 'tools/list', id: 'r1', tabId: 5 };
const probe = { type: 'probe/gpu', id: 'g1', target: 'offscreen' };

describe('held: the service worker routes tool requests only for extension pages', () => {
  it('ignores a tools/list from a content script and from another extension', async () => {
    const { startToolRouting } = await import('../../src/entries/shared/tool-routing');
    startToolRouting();
    const [listener] = stub.messageListeners;
    if (!listener) throw new Error('no listener');
    expect(listener(listRequest, CONTENT, () => undefined)).toBe(false);
    expect(listener(listRequest, { ...PANEL, id: 'other' }, () => undefined)).toBe(false);
    expect(listener(listRequest, { id: EXT, url: undefined }, () => undefined)).toBe(false);
    expect(stub.tabMessages).toEqual([]);
    expect(listener(listRequest, PANEL, () => undefined)).toBe(true);
  });
});

describe('held: the model hosts serve ports only for extension pages', () => {
  it('drops a model port opened by a content script', async () => {
    const { hostModels } = await import('../../src/entries/shared/model-hosting');
    hostModels('offscreen');
    const [onConnect] = stub.connectListeners;
    if (!onConnect) throw new Error('no listener');
    const fromPage = fakePort('model-host:offscreen', CONTENT);
    onConnect(fromPage.port);
    const wrongName = fakePort('model-host:worker', PANEL);
    onConnect(wrongName.port);
    const fromPanel = fakePort('model-host:offscreen', PANEL);
    onConnect(fromPanel.port);
    expect(fromPage.listened).toHaveLength(0);
    expect(wrongName.listened).toHaveLength(0);
    expect(fromPanel.listened).toHaveLength(1);
  });
});

describe('held: the processor model host is served by the offscreen document only, to extension pages', () => {
  it('serves model-host:cpu from the panel, not from a content script, and not in the service worker', async () => {
    const { hostModels } = await import('../../src/entries/shared/model-hosting');
    hostModels('offscreen');
    const [onConnect] = stub.connectListeners;
    if (!onConnect) throw new Error('no listener');
    const fromPage = fakePort('model-host:cpu', CONTENT);
    onConnect(fromPage.port);
    const fromPanel = fakePort('model-host:cpu', PANEL);
    onConnect(fromPanel.port);
    expect(fromPage.listened).toHaveLength(0);
    expect(fromPanel.listened).toHaveLength(1);
  });

  it('the service worker host refuses model-host:cpu (it cannot start a Worker)', async () => {
    const { hostModels } = await import('../../src/entries/shared/model-hosting');
    hostModels('worker');
    const [onConnect] = stub.connectListeners;
    if (!onConnect) throw new Error('no listener');
    const fromPanel = fakePort('model-host:cpu', PANEL);
    onConnect(fromPanel.port);
    expect(fromPanel.listened).toHaveLength(0);
  });
});

describe('finding: the offscreen document trusts any sender URL ending in /service-worker.js', () => {
  it('ignores a probe from a content script on a page with that path', async () => {
    await import('../../src/entries/offscreen');
    const listener = stub.messageListeners.at(-1);
    if (!listener) throw new Error('no listener');
    const page = { ...CONTENT, url: 'https://evil.example/service-worker.js' };
    expect(listener(probe, page, () => undefined)).toBe(false);
    const worker = { id: EXT, url: `${BASE}service-worker.js` };
    expect(listener(probe, worker, () => undefined)).toBe(true);
  });
});

describe('finding: chrome.storage.local stays readable from content scripts', () => {
  it('the service worker restricts storage.local (API key, gate mode) to trusted contexts', async () => {
    await import('../../src/entries/service-worker');
    expect(stub.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });
});
