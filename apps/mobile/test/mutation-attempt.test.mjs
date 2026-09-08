import test from "node:test";
import assert from "node:assert/strict";
import { createMutationAttempt } from "../src/api/mutation-attempt.ts";
test("an uncertain save retries the same frozen payload/key without re-uploading", async () => {
  const attempt = createMutationAttempt(() => "stable-key"),
    sent = [];
  let uploads = 0,
    title = "original";
  const prepare = async (stage) => ({
    title,
    mediaId: await stage("upload", async () => {
      uploads++;
      return "media";
    }),
  });
  const send = async (body, key) => {
    sent.push({ body, key });
    if (sent.length === 1) throw Error("response lost");
    return { id: "published" };
  };
  await assert.rejects(attempt.run("A", prepare, send), /response lost/);
  title = "changed after failure";
  assert.equal((await attempt.run("A", prepare, send)).id, "published");
  assert.equal(uploads, 1);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(attempt.committed, true);
  await attempt.run("A", prepare, send);
  assert.equal(sent.length, 2);
});
test("partial upload retains completed stages, while failed validation can be corrected", async () => {
  const attempt = createMutationAttempt(() => "key");
  let valid = false,
    capture = 0,
    ticket = 0,
    writes = 0;
  const prepare = async (stage) => {
    await stage("draft", async () => {
      if (!valid) throw Error("caption");
      return "valid";
    });
    await stage("capture", async () => ++capture);
    await stage("ticket", async () => ++ticket);
    await stage("put", async () => {
      if (++writes === 1) throw Error("network");
      return true;
    });
    return {};
  };
  await assert.rejects(
    attempt.run("A", prepare, async () => "ok"),
    /caption/,
  );
  valid = true;
  await assert.rejects(
    attempt.run("A", prepare, async () => "ok"),
    /network/,
  );
  assert.equal(await attempt.run("A", prepare, async () => "ok"), "ok");
  assert.equal(capture, 1);
  assert.equal(ticket, 1);
  assert.equal(writes, 2);
});
test("a prepared mutation cannot cross accounts or publish after cancellation", async () => {
  const attempt = createMutationAttempt(() => "key");
  let active = true,
    calls = 0;
  await assert.rejects(
    attempt.run(
      "A",
      async () => {
        active = false;
        return {};
      },
      async () => ++calls,
      () => active,
    ),
  );
  await assert.rejects(
    attempt.run(
      "B",
      async () => ({}),
      async () => ++calls,
    ),
    /이전 계정/,
  );
  assert.equal(calls, 0);
});
test("changing an unsent public draft retries with the new private audience", async () => {
  const attempt = createMutationAttempt(() => "key");
  let audience = "public";
  const prepare = async (stage) => {
    const draft = await stage("draft", async () => ({ audience }));
    if (audience === "public") throw Error("upload");
    return draft;
  };
  attempt.resetUnsentIfChanged(audience);
  await assert.rejects(
    attempt.run("A", prepare, async (body) => body),
    /upload/,
  );
  audience = "private";
  attempt.resetUnsentIfChanged(audience);
  assert.deepEqual(await attempt.run("A", prepare, async (body) => body), { audience: "private" });
});
