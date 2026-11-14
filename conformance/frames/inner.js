// SPDX-License-Identifier: Apache-2.0
// The frame of case C14: registers one tool. ?kind=same or ?kind=cross names it;
// ?expose=<origin> adds exposedTo, so the embedding page may ask for it with fromOrigins.
(async function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const kind = params.get('kind') ?? 'same';
  const expose = params.get('expose');
  const status = document.getElementById('status');
  if (!document.modelContext) {
    status.textContent = 'no document.modelContext in this frame';
    return;
  }
  try {
    await document.modelContext.registerTool(
      {
        name: `c14_inner_${kind}`,
        description: `A tool registered by a ${kind}-origin frame.`,
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: () => `from the ${kind} frame`,
      },
      expose ? { exposedTo: [expose] } : {},
    );
    status.textContent = `Frame registered c14_inner_${kind}.`;
  } catch (error) {
    status.textContent = `Frame could not register: ${error.name}: ${error.message}`;
  }
})();
