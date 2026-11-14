// SPDX-License-Identifier: Apache-2.0
// Runs `action` once, the first time a tab's panel is shown (the shell shows a panel by taking off its
// `hidden` attribute). Used by the tabs that read a file only when the user opens them.
export function onFirstShow(panel: HTMLElement, action: () => void): void {
  if (!panel.hidden) return action();
  const watch = new MutationObserver(() => {
    if (panel.hidden) return;
    watch.disconnect();
    action();
  });
  watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
}
