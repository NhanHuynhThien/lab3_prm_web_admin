import { test } from "node:test";
import assert from "node:assert/strict";
import { crashRows, CrashlyticsReader } from "../src/crashlytics.js";
import type { Config } from "../src/config.js";
test("Crash report exposes only explicit operational fields and preserves unknown vs zero", () => {
  const rows = crashRows(
    {
      groups: [
        {
          issue: {
            id: "qa",
            title: "Function at user@example.com",
            subtitle: "PRIVATE NOTE",
            userId: "PRIVATE UID",
            errorType: "NON_FATAL",
          },
          metrics: [
            {
              eventsCount: "0",
              impactedUsersCount: "0",
              impactedSessionsCount: "3",
              crashFreeUsersPercentage: 101,
            },
          ],
          events: ["PRIVATE EVENT"],
          customKeys: { token: "PRIVATE KEY" },
        },
      ],
    },
    "https://console.firebase.google.com/",
  );
  assert.equal(rows[0].events, 0);
  assert.equal(rows[0].users, 0);
  assert.equal(rows[0].sessions, 3);
  assert.equal(rows[0].crashFreeUsers, null);
  assert.ok(!JSON.stringify(rows).includes("PRIVATE"));
  assert.ok(!JSON.stringify(rows).includes("user@example.com"));
  assert.equal(crashRows({ groups: [{ metrics: [{}] }] }, "")[0].events, null);
});
test("Disabled Crashlytics never calls an upstream identity or returns demo metrics", async () => {
  const c = {
    CRASHLYTICS_ENABLED: "false",
    FIREBASE_ANDROID_APP_ID: "",
  } as Config;
  const reader = new CrashlyticsReader(c, async () => {
    throw new Error("must not call");
  });
  const r = await reader.read({ days: 7 });
  assert.equal(r.configured, false);
  assert.deepEqual(r.rows, []);
});
