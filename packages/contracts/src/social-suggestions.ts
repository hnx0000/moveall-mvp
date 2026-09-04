export type ShareFrequency = { userId: string; count: number; lastSharedAt: string };

export function rankSocialPeople<T extends { id: string; displayName: string }>(
  people: T[],
  history: ShareFrequency[],
) {
  const scores = new Map(history.map((item) => [item.userId, item]));
  const ranked = [...people].sort((a, b) => {
    const left = scores.get(a.id);
    const right = scores.get(b.id);
    return (
      (right?.count ?? 0) - (left?.count ?? 0) ||
      (right?.lastSharedAt ?? "").localeCompare(left?.lastSharedAt ?? "") ||
      a.displayName.localeCompare(b.displayName, "ko") ||
      a.id.localeCompare(b.id)
    );
  });
  return {
    people: ranked,
    frequentIds: ranked
      .filter((person) => (scores.get(person.id)?.count ?? 0) > 0)
      .slice(0, 4)
      .map((person) => person.id),
  };
}
