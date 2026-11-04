import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
const id = text(128).regex(/^[a-zA-Z0-9._:-]+$/);
export const routeTarget = z.enum([
  "overview",
  "accounts",
  "analytics",
  "profile",
]);
export const modelBody = z
  .object({
    id,
    provider: z.enum(["openai", "anthropic", "google", "other"]),
    name: text(100),
    status: z.enum(["active", "paused", "deprecated"]),
    description: z.string().trim().max(400),
    revision: z.number().int().nonnegative().max(1e9),
  })
  .strict();
const safeInt = z.number().int().nonnegative().max(1e12);
export const priceBody = z
  .object({
    modelId: id,
    inputMicros: safeInt,
    outputMicros: safeInt,
    cacheMicros: safeInt.nullable(),
    effectiveFrom: z.iso.datetime(),
    sourceUrl: z
      .url()
      .refine((v) => v.startsWith("https://"), "Nguồn giá phải dùng HTTPS."),
  })
  .strict();
export const deviceBody = z
  .object({
    token: text(4096),
    platform: z.enum(["android", "ios"]),
    appVersion: text(40),
    consent: z.literal(true),
  })
  .strict();
export const notificationBody = z
  .object({
    title: text(100),
    body: text(500),
    target: routeTarget,
    audience: z.enum(["self", "all"]),
    requestId: z.uuid(),
  })
  .strict();
export const sendBody = notificationBody
  .extend({ confirmation: z.literal("SEND") })
  .strict();
export const aggregateBody = z
  .object({
    consent: z.literal(true),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    inputTokens: safeInt.nullable(),
    outputTokens: safeInt.nullable(),
    totalTokens: safeInt,
    costMicros: safeInt.nullable(),
    source: z.enum(["manual", "cli", "mixed"]),
    coverage: z
      .object({
        sessions: safeInt,
        knownTokenSessions: safeInt,
        knownCostSessions: safeInt,
      })
      .strict()
      .optional(),
    details: z
      .array(
        z
          .object({
            purpose: z.enum([
              "code",
              "debug",
              "test",
              "review",
              "design",
              "learn",
              "write",
              "research",
              "other",
            ]),
            sessions: safeInt,
            knownTokens: safeInt,
            knownCostMicros: safeInt,
            unknownTokenSessions: safeInt,
            unknownCostSessions: safeInt,
            firstAt: z.iso.datetime().nullable(),
            lastAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(9)
      .optional(),
    purposes: z
      .array(
        z
          .object({
            purpose: z.enum([
              "code",
              "debug",
              "test",
              "review",
              "design",
              "learn",
              "write",
              "research",
              "other",
            ]),
            tokens: safeInt,
          })
          .strict(),
      )
      .max(9),
  })
  .strict()
  .superRefine((a, c) => {
    if (
      a.coverage &&
      (a.coverage.knownTokenSessions > a.coverage.sessions ||
        a.coverage.knownCostSessions > a.coverage.sessions)
    )
      c.addIssue({ code: "custom", message: "Coverage không hợp lệ." });
    if (a.details) {
      const ds = a.details;
      const valid =
        new Set(ds.map((d) => d.purpose)).size === ds.length &&
        ds.reduce((n, d) => n + d.knownTokens, 0) === a.totalTokens &&
        ds.every(
          (d) =>
            d.unknownTokenSessions <= d.sessions &&
            d.unknownCostSessions <= d.sessions &&
            a.purposes.some(
              (p) => p.purpose === d.purpose && p.tokens === d.knownTokens,
            ),
        );
      if (!valid)
        c.addIssue({
          code: "custom",
          message: "Chi tiết mục đích không khớp aggregate.",
        });
    }
    if (
      Date.parse(a.periodEnd) < Date.parse(a.periodStart) ||
      Date.parse(a.periodEnd) - Date.parse(a.periodStart) > 366 * 86400000
    )
      c.addIssue({ code: "custom", message: "Kỳ phân tích không hợp lệ." });
    if (
      new Set(a.purposes.map((p) => p.purpose)).size !== a.purposes.length ||
      a.purposes.reduce((n, p) => n + p.tokens, 0) !== a.totalTokens
    )
      c.addIssue({
        code: "custom",
        message: "Phân bổ mục đích không khớp tổng token.",
      });
    if (
      (a.inputTokens == null) !== (a.outputTokens == null) ||
      (a.inputTokens != null && a.inputTokens + a.outputTokens! > a.totalTokens)
    )
      c.addIssue({ code: "custom", message: "Input/output không hợp lệ." });
  });
export type Model = z.infer<typeof modelBody> & { updatedAt: string };
export type Price = z.infer<typeof priceBody> & {
  id: string;
  createdAt: string;
  createdBy: string;
};
export type NotificationDraft = z.infer<typeof notificationBody>;
