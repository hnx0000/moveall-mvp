import assert from "node:assert/strict";
import test from "node:test";
import {
  mentionQuery,
  insertMention,
  updateMentionRanges,
  mentionParts,
} from "../src/components/comment-mentions.ts";
import { rankSocialPeople } from "../../../packages/contracts/src/social-suggestions.ts";

test("share suggestions use frequency, recency, and only current following; top four are frequent", () => {
  const people = "abcdef".split("").map((id) => ({ id, displayName: id }));
  const history = [
    { userId: "outsider", count: 100, lastSharedAt: "2026-09-03" },
    ..."edcba"
      .split("")
      .map((userId, index) => ({ userId, count: 10 - index, lastSharedAt: "2026-09-03" })),
  ];
  const result = rankSocialPeople(people, history);
  assert.deepEqual(result.frequentIds, ["e", "d", "c", "b"]);
  assert.deepEqual(
    result.people.map((person) => person.id),
    ["e", "d", "c", "b", "a", "f"],
  );
});

test("Korean names containing spaces autocomplete into stable user tags", () => {
  const text = "안녕 @스튜디오 서";
  const query = mentionQuery(text, text.length);
  assert.equal(query.query, "스튜디오 서");
  const result = insertMention(text, query, { id: "seoa", displayName: "스튜디오 서아" }, []);
  assert.equal(result.text, "안녕 @스튜디오 서아 ");
  assert.deepEqual(mentionParts(result.text, result.mentions), [
    { text: "안녕 " },
    { text: "@스튜디오 서아", userId: "seoa" },
    { text: " " },
  ]);
  const edited = "반가워 " + result.text;
  const shifted = updateMentionRanges(result.text, edited, result.mentions);
  assert.equal(shifted[0].start, result.mentions[0].start + 4);
  assert.deepEqual(
    updateMentionRanges(result.text, result.text.replace("서아", "서연"), result.mentions),
    [],
  );
});

test("mid-sentence insertion preserves text after the caret and untouched tags", () => {
  const text = "@민지 같이 운동해요";
  const result = insertMention(
    text,
    mentionQuery(text, 3),
    { id: "minji", displayName: "새벽러너 민지" },
    [],
  );
  assert.ok(result.text.endsWith("같이 운동해요"));
  assert.equal(result.mentions[0].userId, "minji");
  assert.equal(mentionQuery("hi@email.com", 12), null);
});
