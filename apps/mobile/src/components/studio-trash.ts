import type { StudioLayer } from "./record-studio-model";

export type TrashBounds = { x: number; y: number; width: number; height: number };
export type LayerDrag = {
  phase: "move" | "end" | "cancel";
  x: number;
  y: number;
  origin: StudioLayer;
};

export function isOverTrash(x: number, y: number, bounds: TrashBounds | null) {
  return Boolean(
    bounds &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height,
  );
}

/** Preserve content and the pre-drag position so the eye toggle can restore it in view. */
export function hideDraggedLayer(layers: StudioLayer[], origin: StudioLayer) {
  return layers.map((item) =>
    item.id === origin.id ? { ...item, x: origin.x, y: origin.y, visible: false } : item,
  );
}
