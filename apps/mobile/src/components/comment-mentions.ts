import type { CommentMention } from "@moveall/contracts";

export function mentionQuery(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const match = /(?:^|\s)@([^@\n]*)$/.exec(before);
  return match ? { start: before.lastIndexOf("@"), end: cursor, query: match[1] ?? "" } : null;
}

export function updateMentionRanges(previous: string, next: string, mentions: CommentMention[]) {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  let oldEnd = previous.length;
  let newEnd = next.length;
  while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === next[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const delta = newEnd - oldEnd;
  return mentions
    .flatMap((mention) => {
      if (mention.end <= start) return [mention];
      if (mention.start >= oldEnd)
        return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      return [];
    })
    .filter((mention) => next.slice(mention.start, mention.end) === `@${mention.displayName}`);
}

export function insertMention(
  text: string,
  query: { start: number; end: number },
  person: { id: string; displayName: string },
  mentions: CommentMention[],
) {
  const tag = `@${person.displayName}`;
  const next = text.slice(0, query.start) + tag + " " + text.slice(query.end);
  const updated = updateMentionRanges(text, next, mentions);
  return {
    text: next,
    cursor: query.start + tag.length + 1,
    mentions: [
      ...updated,
      {
        userId: person.id,
        displayName: person.displayName,
        start: query.start,
        end: query.start + tag.length,
      },
    ].sort((a, b) => a.start - b.start),
  };
}

export function mentionParts(text: string, mentions: CommentMention[] = []) {
  const parts: { text: string; userId?: string }[] = [];
  let cursor = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (
      mention.start < cursor ||
      text.slice(mention.start, mention.end) !== `@${mention.displayName}`
    )
      continue;
    if (mention.start > cursor) parts.push({ text: text.slice(cursor, mention.start) });
    parts.push({ text: text.slice(mention.start, mention.end), userId: mention.userId });
    cursor = mention.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
