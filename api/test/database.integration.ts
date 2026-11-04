// Opt-in live Supabase verification. Only disposable QA records from this run are removed.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readConfig } from "../src/config.js";
import { Store } from "../src/store.js";
const c = readConfig();
const store = new Store(
  c.SUPABASE_URL,
  c.SUPABASE_SECRET_KEY,
  c.DEVICE_ENCRYPTION_KEY,
);
const actor = `qa-${randomUUID()}`,
  other = `${actor}-other`,
  id = `${actor}-model`,
  jobId = randomUUID();
const check = (r: { error: any }) => {
  if (r.error)
    throw new Error("QA cleanup failed; inspect only this run’s QA rows");
};
try {
  await store.summary();
  const model = {
    id,
    name: "QA disposable model",
    provider: "other" as const,
    status: "paused" as const,
    description: "Automated isolated QA",
    revision: 0,
  };
  const first = await store.saveModel(model, actor);
  assert.equal(first.revision, 1);
  await assert.rejects(store.saveModel(model, actor), { statusCode: 409 });
  const concurrent = await Promise.allSettled([
    store.saveModel({ ...model, revision: 1 }, actor),
    store.saveModel({ ...model, revision: 1 }, actor),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const price = {
    modelId: id,
    inputMicros: 1000000,
    outputMicros: 2000000,
    cacheMicros: null,
    effectiveFrom: "2026-11-04T00:00:00Z",
    sourceUrl: "https://example.com/qa-pricing",
  };
  await store.savePrice(price, actor);
  await assert.rejects(store.savePrice(price, actor), { statusCode: 409 });
  const token = `qa-not-an-fcm-token-${randomUUID()}`,
    hash = createHash("sha256").update(token).digest("hex");
  await store.saveDevice(actor, "qa-device", token, hash, {
    consent: true,
    platform: "android",
  });
  const raw = await store.db
    .from("tl_devices")
    .select("token")
    .eq("uid", actor);
  assert.equal(raw.error, null);
  assert.notEqual(raw.data![0].token, token);
  assert.equal((await store.devices(actor))[0].token, token);
  await store.removeDevice(other, "qa-device");
  assert.equal((await store.devices(actor)).length, 1);
  const draft = {
    title: "QA",
    body: "No actual delivery",
    target: "overview" as const,
    audience: "self" as const,
    requestId: jobId,
  };
  assert.equal((await store.claimJob(draft, actor)).existing, false);
  assert.equal((await store.claimJob(draft, actor)).existing, true);
  await assert.rejects(store.claimJob({ ...draft, body: "Changed" }, actor), {
    statusCode: 409,
  });
  await store.finishJob(
    {
      id: jobId,
      title: "QA",
      body: "No push",
      target: "overview",
      createdAt: new Date().toISOString(),
      status: "accepted",
    },
    [actor],
  );
  assert.equal((await store.inbox(other)).length, 0);
  await assert.rejects(store.readInbox(other, jobId), { statusCode: 404 });
  await store.readInbox(actor, jobId);
  assert.ok((await store.inbox(actor))[0].readAt);
  const analysisId = await store.reserveAnalysis(actor, 1);
  await assert.rejects(store.reserveAnalysis(actor, 1), { statusCode: 429 });
  await store.finishAnalysis(analysisId, other, { status: "complete" });
  assert.equal((await store.analyses(actor))[0].status, "running");
  await store.finishAnalysis(analysisId, actor, { status: "complete" });
  assert.equal((await store.analyses(actor))[0].status, "complete");
  console.log(
    "Supabase integration PASS: connectivity, atomic model revisions, prices, device encryption, owner isolation, idempotency, inbox and daily cap. No model call or push.",
  );
} finally {
  for (const table of ["inbox", "devices", "analyses"])
    check(await store.db.from(`tl_${table}`).delete().eq("uid", actor));
  check(await store.db.from("tl_jobs").delete().eq("id", jobId));
  check(await store.db.from("tl_prices").delete().eq("model_id", id));
  check(await store.db.from("tl_models").delete().eq("id", id));
  check(await store.db.from("tl_audit").delete().eq("payload->>actor", actor));
}
