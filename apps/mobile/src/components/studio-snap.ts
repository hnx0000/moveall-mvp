import type { StudioLayer } from "./record-studio-model";

export type SnapGuides = { x?: number; y?: number };
export const isTextLayer = (item: StudioLayer) => ["text", "metric", "brand"].includes(item.kind);

/** Four screen pixels: close alignment assistance, not a grid or a large magnet. */
export function snapTextPosition(
  item: StudioLayer,
  x: number,
  y: number,
  siblings: StudioLayer[],
  displayScale: number,
) {
  const threshold = 4 / Math.max(0.1, displayScale);
  const guides: SnapGuides = {};
  if (!isTextLayer(item) || Math.abs(item.rotation % 180) > 0.1) return { x, y, guides };
  const targets = siblings.filter(
    (other) =>
      other.id !== item.id &&
      other.visible &&
      isTextLayer(other) &&
      Math.abs(other.rotation % 180) < 0.1,
  );
  function align(axis: "x" | "y", value: number) {
    const size = axis === "x" ? "width" : "height";
    const half = (item[size] * item.scale) / 2;
    let best = threshold + 0.001;
    let result = value;
    for (const other of targets) {
      // Matching left/center/right and top/middle/bottom anchors only.
      for (const fraction of [0, -1, 1]) {
        const target = other[axis] + (fraction * other[size] * other.scale) / 2;
        const delta = target - (value + fraction * half);
        if (Math.abs(delta) <= threshold && Math.abs(delta) < best) {
          best = Math.abs(delta);
          result = value + delta;
          guides[axis] = target;
        }
      }
    }
    return result;
  }
  return { x: align("x", x), y: align("y", y), guides };
}
