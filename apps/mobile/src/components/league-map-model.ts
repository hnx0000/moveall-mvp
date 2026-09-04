export type LeagueViewport = { x: number; y: number; width: number; height: number };

export const NATIONAL_VIEW: LeagueViewport = { x: 0, y: 0, width: 300, height: 430 };
export const SEOUL_VIEW: LeagueViewport = { x: 91.5, y: 41.8, width: 18.5, height: 14 };

export function zoomViewport(
  viewport: LeagueViewport,
  factor: number,
  limits: LeagueViewport = NATIONAL_VIEW,
) {
  const width = clamp(viewport.width * factor, 4.5, limits.width);
  const height = clamp(viewport.height * factor, 3.4, limits.height);
  return clampViewport(
    {
      x: viewport.x + (viewport.width - width) / 2,
      y: viewport.y + (viewport.height - height) / 2,
      width,
      height,
    },
    limits,
  );
}

export function panViewport(
  viewport: LeagueViewport,
  deltaX: number,
  deltaY: number,
  surfaceWidth: number,
  surfaceHeight: number,
  limits: LeagueViewport = NATIONAL_VIEW,
) {
  if (surfaceWidth <= 0 || surfaceHeight <= 0) return viewport;
  return clampViewport(
    {
      ...viewport,
      x: viewport.x - (deltaX / surfaceWidth) * viewport.width,
      y: viewport.y - (deltaY / surfaceHeight) * viewport.height,
    },
    limits,
  );
}

export function focusViewport(center: [number, number], width = 8) {
  const height = width * 0.76;
  return clampViewport({ x: center[0] - width / 2, y: center[1] - height / 2, width, height });
}

export function zoomLevel(viewport: LeagueViewport) {
  return SEOUL_VIEW.width / viewport.width;
}

function clampViewport(viewport: LeagueViewport, limits = NATIONAL_VIEW) {
  const width = Math.min(viewport.width, limits.width);
  const height = Math.min(viewport.height, limits.height);
  return {
    x: clamp(viewport.x, limits.x, limits.x + limits.width - width),
    y: clamp(viewport.y, limits.y, limits.y + limits.height - height),
    width,
    height,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
