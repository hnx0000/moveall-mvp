export function resizeFromHandle({
  scale,
  rotation,
  displayScale,
  width,
  height,
  corner,
  dx,
  dy,
}: {
  scale: number;
  rotation: number;
  displayScale: number;
  width: number;
  height: number;
  corner: string;
  dx: number;
  dy: number;
}) {
  const angle = (rotation * Math.PI) / 180;
  const localX = (dx * Math.cos(angle) + dy * Math.sin(angle)) / displayScale;
  const localY = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / displayScale;
  const change =
    (corner.includes("e") ? localX : -localX) / width +
    (corner.includes("s") ? localY : -localY) / height;
  return Math.max(0.15, Math.min(6, scale + change));
}
