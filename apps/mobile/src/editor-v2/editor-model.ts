export type CanvasRatio = "1:1" | "2:3" | "3:2" | "4:5" | "9:16";
export type PhotoAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  highlights: number;
  shadows: number;
};
export type EditorLayerType = "text" | "record";

export type EditorTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type EditorLayer = EditorTransform & {
  id: string;
  type: EditorLayerType;
  text: string;
  visible: boolean;
  zIndex: number;
  recordLayout?: "core" | "stub";
};

export type EditorDocumentV2 = {
  version: 2;
  ratio: CanvasRatio;
  filter: "original" | "warm" | "cool" | "contrast" | "mono";
  adjustments: PhotoAdjustments;
  photo: EditorTransform;
  layers: EditorLayer[];
};

export const initialEditorDocument: EditorDocumentV2 = {
  version: 2,
  ratio: "4:5",
  filter: "original",
  adjustments: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, highlights: 0, shadows: 0 },
  photo: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  layers: [],
};

export function clampTransform(transform: EditorTransform, isPhoto = false): EditorTransform {
  const margin = isPhoto ? 0 : 0.08;
  return {
    x: clamp(transform.x, margin, 1 - margin),
    y: clamp(transform.y, margin, 1 - margin),
    scale: clamp(transform.scale, isPhoto ? 1 : 0.45, isPhoto ? 4 : 3),
    rotation: normalizeRotation(transform.rotation),
  };
}

export function applyGesture(
  start: EditorTransform,
  gesture: { dx: number; dy: number; scale: number; rotation: number },
  canvas: { width: number; height: number },
  isPhoto = false,
) {
  return clampTransform({
    x: start.x + gesture.dx / Math.max(canvas.width, 1),
    y: start.y + gesture.dy / Math.max(canvas.height, 1),
    scale: start.scale * gesture.scale,
    rotation: start.rotation + gesture.rotation,
  }, isPhoto);
}

export function touchGeometry(touches: Array<{ pageX: number; pageY: number }>) {
  if (touches.length < 2) return null;
  const [a, b] = touches;
  const dx = b!.pageX - a!.pageX;
  const dy = b!.pageY - a!.pageY;
  return {
    centerX: (a!.pageX + b!.pageX) / 2,
    centerY: (a!.pageY + b!.pageY) / 2,
    distance: Math.max(Math.hypot(dx, dy), 1),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export function pushHistory(history: EditorDocumentV2[], next: EditorDocumentV2, limit = 50) {
  return [...history, structuredClone(next)].slice(-limit);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
