import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/gemini.js";
import type { Config } from "../src/config.js";
const config = {
  GEMINI_ENABLED: "true",
  GEMINI_API_KEY: "unit-not-a-key",
  GEMINI_MODEL: "gemini-3.8-flash",
  AI_TIMEOUT_MS: 1000,
  AI_MAX_OUTPUT_TOKENS: 2048,
} as Config;
const data = {
  consent: true as const,
  periodStart: "2026-11-01T00:00:00Z",
  periodEnd: "2026-11-02T00:00:00Z",
  inputTokens: 80,
  outputTokens: 20,
  totalTokens: 100,
  costMicros: null,
  source: "manual" as const,
  purposes: [{ purpose: "test" as const, tokens: 100 }],
};
test("Gemini returns observed usage, ignores thought text, never invents invoice", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "low");
    assert.equal(body.generationConfig.temperature, undefined);
    return new Response(
      JSON.stringify({
        modelVersion: "gemini-3.8-flash",
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "internal reasoning" },
                {
                  text: JSON.stringify({
                    summary: "QA aggregate",
                    findings: ["100 known tokens"],
                    recommendations: [],
                    limitations: ["Unknown cost"],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 123,
          candidatesTokenCount: 40,
          totalTokenCount: 163,
          cachedContentTokenCount: 0,
        },
      }),
    );
  };
  const r = await analyze(config, data);
  assert.equal(r.usage.inputTokens, 123);
  assert.equal(r.usage.cachedInputTokens, 0);
  assert.equal(r.usage.reasoningTokens, null);
  assert.equal(r.billedCostMicros, null);
  assert.equal(r.result.summary, "QA aggregate");
});
for (const [status, expected] of [
  [429, 429],
  [503, 503],
  [404, 503],
])
  test(`Gemini ${status} has a safe actionable error`, async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
    });
    globalThis.fetch = async () => new Response("{}", { status });
    await assert.rejects(analyze(config, data), { statusCode: expected });
  });
test("Gemini timeout is reported without leaking upstream credentials", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => {
    throw new Error("secret upstream detail");
  };
  await assert.rejects(
    analyze(config, data),
    (e) =>
      (e as any).statusCode === 504 && !(e as Error).message.includes("secret"),
  );
});
