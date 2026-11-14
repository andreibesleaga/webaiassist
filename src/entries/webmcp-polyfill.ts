// SPDX-License-Identifier: Apache-2.0
// Compat mode: the W3C WebMCP polyfill (@w3c/webmcp-polyfill, Apache-2.0). Registered for
// one site at document start in the MAIN world, and only after the user turns compat mode
// on for that site (src/adapters/compat-mode.ts). It does nothing when the browser already
// has `document.modelContext`.
import { installWebMCP } from '@w3c/webmcp-polyfill';

installWebMCP();
