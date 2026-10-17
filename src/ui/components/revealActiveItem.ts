/**
 * Scrolls a horizontal strip — tabs, a section navigation — so its active item is fully in view.
 *
 * A phone shows only the first few items of a strip, and a strip opened on its fifth tab otherwise
 * hides the one thing that says which view is open. Only the strip scrolls: `scrollIntoView` would
 * move the page as well.
 */
export function revealActiveItem(strip: HTMLElement | null, activeSelector: string): void {
  if (strip === null || strip.scrollWidth <= strip.clientWidth) {
    return;
  }
  const active = strip.querySelector<HTMLElement>(activeSelector);
  if (active === null) {
    return;
  }
  const stripBox = strip.getBoundingClientRect();
  const activeBox = active.getBoundingClientRect();
  const margin = 16;
  if (activeBox.left < stripBox.left) {
    strip.scrollLeft -= stripBox.left - activeBox.left + margin;
  } else if (activeBox.right > stripBox.right) {
    strip.scrollLeft += activeBox.right - stripBox.right + margin;
  }
}
