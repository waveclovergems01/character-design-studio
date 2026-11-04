/** Middle-button drag: moving the pointer right scrolls the artwork left, and vice versa. */
export function panScrollPosition(startScroll: number, pointerStart: number, pointerNow: number): number {
  return startScroll - (pointerNow - pointerStart);
}
