import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { characters } from "@moveall/contracts";
import { demoSocialName, demoSocialRegion } from "../src/api/demo-social-identity.ts";

test("fictional accounts have distinct social handles without changing real member names", () => {
  const ids = [...characters.map(person => `demo-character-${person.id}`), ...[1,2,3,4,5,6,7,8].map(id => `demo-friend-${id}`), "demo-friend-private"];
  const handles = ids.map(id => demoSocialName(id, "이름"));
  assert.equal(new Set(handles).size, handles.length);
  assert.ok(handles.every(handle => /^[a-z0-9]+(?:[_.][a-z0-9]+)*$/.test(handle)));
  assert.equal(demoSocialName("demo-character-haerin", "문해린"), "hailey_run");
  assert.equal(demoSocialName("real-user", "박민"), "박민");
  assert.equal(demoSocialRegion("real-user"), undefined);
});

test("demo feed and member profiles expose the same handles and sample region", async () => {
  const { demoApi } = await import("../src/api/demo-client.ts");
  const posts = await demoApi.feed("demo");
  const post = posts.find(post => post.userId === "demo-character-haerin");
  assert.ok(post);
  assert.equal(post.authorDisplayName, "hailey_run");
  assert.equal(post.authorRegionLabel, "서울");
  const legacy = posts.find(post => post.userId === "demo-friend-1");
  assert.equal(legacy.authorDisplayName, "minji_run");
});

test("feed metadata sits below the author and actions live inside the more menu", async () => {
  const source = await readFile(new URL("../src/screens/feed-screen.tsx", import.meta.url), "utf8");
  assert.match(source, /styles.authorCopy[\s\S]*relativeTime\(post.createdAt\)\} · \{post.authorRegionLabel/);
  assert.match(source, /event.stopPropagation\(\); setMenuPost\(post\)/);
  assert.doesNotMatch(source, /styles.followButton|styles.reportButton|Alert.alert/);
  assert.match(source, /팔로잉 · 팔로우 해제/);
  assert.match(source, /api.createReport/);
  assert.match(source, /onConfirm=\{\(\) => void confirmReport\(\)\}/);
});
