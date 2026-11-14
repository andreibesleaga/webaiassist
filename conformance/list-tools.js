// SPDX-License-Identifier: Apache-2.0
// The "List the tools registered right now" button of the index: name, hints and description of
// every tool getTools() returns, as text.
(function () {
  'use strict';
  const hintsOf = (annotations) =>
    Object.entries(annotations ?? {})
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .join(', ');

  async function list() {
    const target = document.getElementById('tool-list');
    target.replaceChildren();
    if (!document.modelContext) {
      target.append(
        Object.assign(document.createElement('li'), {
          textContent: 'No tools: this browser has no document.modelContext.',
        }),
      );
      return;
    }
    const tools = await document.modelContext.getTools();
    for (const tool of tools) {
      const item = document.createElement('li');
      const hints = hintsOf(tool.annotations);
      item.textContent = `${tool.name}${hints ? ` [${hints}]` : ''}: ${String(tool.description).slice(0, 160)}`;
      target.append(item);
    }
    if (tools.length === 0) {
      target.append(
        Object.assign(document.createElement('li'), { textContent: 'None. Open a case first.' }),
      );
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('list-tools')?.addEventListener('click', () => void list());
  });
})();
