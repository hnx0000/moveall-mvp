export function moveListItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function reorderTarget(rows: { y: number; height: number }[], from: number, dy: number): number {
  const source = rows[from];
  if (!source) return from;
  const center = source.y + source.height / 2 + dy;
  let target = from;
  rows.forEach((row, index) => {
    if (index > from && center > row.y + row.height / 2) target = index;
    if (index < from && center < row.y + row.height / 2) target = Math.min(target, index);
  });
  return target;
}
