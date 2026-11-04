import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { aggregateBody, priceBody } from "../src/schemas.js";
import type { Config } from "../src/config.js";
import type { Store } from "../src/store.js";

const config = {
  origins: ["http://localhost:5173"],
  FIREBASE_PROJECT_ID: "test-project",
  FCM_ENABLED: "true",
  GEMINI_ENABLED: "true",
  AI_MAX_REQUESTS_PER_USER_DAY: 2,
} as Config;
async function fixture() {
  const owners: string[] = [];
  const store = {
    close() {},
    async audit() {},
    async summary() {
      return { models: 2 };
    },
    async models() {
      return [{ id: "model" }];
    },
    async prices() {
      return [];
    },
    async inbox(uid: string) {
      owners.push(uid);
      return [{ id: uid }];
    },
    async analyses(uid: string) {
      owners.push(uid);
      return [{ id: uid }];
    },
    async devices() {
      return [];
    },
    async readInbox(uid: string) {
      owners.push(uid);
    },
  } as unknown as Store;
  const app = await buildApp({
    config,
    store,
    verify: async (token) => {
      if (!["user-a", "user-b", "admin"].includes(token))
        throw new Error("invalid token");
      return { uid: token, email: null, admin: token === "admin" };
    },
    send: async () => {
      throw new Error("Test must not send real push");
    },
  });
  return { app, owners };
}
const headers = (uid: string) => ({ authorization: `Bearer ${uid}` });

test("health public; operations require verified identity and administrator", async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  assert.equal((await app.inject("/health")).statusCode, 200);
  assert.equal((await app.inject("/v1/catalog")).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/v1/session", headers: headers("forged") }))
      .statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/v1/admin/status", headers: headers("user-a") }))
      .statusCode,
    403,
  );
  const status = await app.inject({
    url: "/v1/admin/status",
    headers: headers("admin"),
  });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().counts.models, 2);
  const catalog = await app.inject({
    url: "/v1/catalog",
    headers: headers("user-a"),
  });
  assert.deepEqual(catalog.json(), { models: [{ id: "model" }], prices: [] });
});
test("owner comes from verified token; query cannot select another user", async (t) => {
  const { app, owners } = await fixture();
  t.after(() => app.close());
  for (const uid of ["user-a", "user-b"]) {
    for (const resource of ["notifications", "analyses"]) {
      const r = await app.inject({
        url: `/v1/me/${resource}?uid=other`,
        headers: headers(uid),
      });
      assert.equal(r.statusCode, 200);
      assert.equal(r.json()[resource][0].id, uid);
    }
  }
  assert.deepEqual(owners, ["user-a", "user-a", "user-b", "user-b"]);
});
test("notification preview never sends; no devices prevents job creation", async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const draft = {
    title: "QA",
    body: "QA notification",
    target: "overview",
    audience: "self",
    requestId: randomUUID(),
  };
  const preview = await app.inject({
    method: "POST",
    url: "/v1/admin/notification-jobs/preview",
    headers: headers("admin"),
    payload: draft,
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.json().deviceCount, 0);
  const send = await app.inject({
    method: "POST",
    url: "/v1/admin/notification-jobs",
    headers: headers("admin"),
    payload: { ...draft, confirmation: "SEND" },
  });
  assert.equal(send.statusCode, 409);
  const invalid = await app.inject({
    method: "POST",
    url: "/v1/admin/notification-jobs/preview",
    headers: headers("admin"),
    payload: { ...draft, target: "https://evil.invalid" },
  });
  assert.equal(invalid.statusCode, 400);
});
test("analysis contract rejects private text, missing consent, false totals and duplicate purposes", () => {
  const value = {
    consent: true,
    periodStart: "2026-11-01T00:00:00Z",
    periodEnd: "2026-11-02T00:00:00Z",
    inputTokens: null,
    outputTokens: null,
    totalTokens: 100,
    costMicros: null,
    source: "manual",
    purposes: [{ purpose: "code", tokens: 100 }],
  };
  assert.equal(aggregateBody.safeParse(value).success, true);
  for (const invalid of [
    { ...value, chat: "private" },
    { ...value, consent: false },
    { ...value, totalTokens: 101 },
    { ...value, periodEnd: "2025-01-01T00:00:00Z" },
    {
      ...value,
      purposes: [
        { purpose: "code", tokens: 50 },
        { purpose: "code", tokens: 50 },
      ],
    },
  ])
    assert.equal(aggregateBody.safeParse(invalid).success, false);
});
test("prices require safe integer micros, HTTPS source and a precise effective date", () => {
  const value = {
    modelId: "model",
    inputMicros: 0,
    outputMicros: 1000000,
    cacheMicros: null,
    effectiveFrom: "2026-11-04T00:00:00Z",
    sourceUrl: "https://example.com/pricing",
  };
  assert.equal(priceBody.safeParse(value).success, true);
  for (const invalid of [
    { ...value, inputMicros: 0.1 },
    { ...value, inputMicros: -1 },
    { ...value, sourceUrl: "javascript:alert(1)" },
    { ...value, effectiveFrom: "tomorrow" },
  ])
    assert.equal(priceBody.safeParse(invalid).success, false);
});
