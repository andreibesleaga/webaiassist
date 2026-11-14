// SPDX-License-Identifier: Apache-2.0
// MAIN-world script: reads the page's WebMCP registry (`document.modelContext`, with
// `navigator.modelContext` as the older name) and runs tools for the extension. It runs
// in the page's own JavaScript world, so the page can see and imitate its messages: the
// trust boundary (docs/ARCHITECTURE.md). Logic: src/adapters/page-bridge-main.ts.
import { startMainBridge } from '../adapters/page-bridge-main';
import { findModelContext } from '../adapters/webmcp-reader';

startMainBridge(window, () => findModelContext(document, navigator).context);
