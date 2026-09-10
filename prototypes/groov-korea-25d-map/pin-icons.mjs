export function pinIcon(kind, number = 1) {
  // Preserve the supplied pin silhouettes: hollow, numbered, return arrow, ring, star.
  const slender = kind === 'start' || kind === 'turn' || kind === 'loop';
  const body = slender
    ? 'M20 3C10 3 3 11 3 21c0 9 11 22 17 39 6-17 17-30 17-39C37 11 30 3 20 3Z'
    : 'M20 3C9 3 2 11 2 21c0 12 12 29 18 39 6-10 18-27 18-39C38 11 31 3 20 3Z';
  const center = kind === 'saved'
    ? '<path d="m20 9 3.6 8.3 9 .8-6.9 5.8 2.1 8.8-7.8-4.6-7.8 4.6 2.1-8.8-6.9-5.8 9-.8Z" fill="var(--saved-place-star, #858985)"/>'
    : kind === 'loop'
      ? '<circle cx="20" cy="21" r="12.5" fill="none" stroke="#fff" stroke-width="2.8"/>'
      : `<circle cx="20" cy="21" r="12.5" fill="#fff"/>${kind === 'waypoint' ? `<text x="20" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="400" fill="#292928">${Math.max(1, Math.floor(Number(number) || 1))}</text>` : ''}`;
  const arrow = kind === 'turn'
    ? '<path d="M13 55C-1 56 3 64 20 64s22-8 10-10" fill="none" stroke="#363635" stroke-width="1.8"/><path d="m27 54 8-4-3 8Z" fill="#363635"/>'
    : '';
  return `<svg viewBox="0 0 40 66" width="32" height="48" fill="none" aria-hidden="true"><path d="${body}" fill="${kind === 'saved' ? 'none' : '#363635'}" stroke="${kind === 'saved' ? '#fff' : '#242423'}" stroke-width="${kind === 'saved' ? '2.2' : '1.2'}"/>${center}${arrow}</svg>`;
}
