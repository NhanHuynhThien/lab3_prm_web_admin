import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import type { VerifyToken, Identity } from "./firebase.js";
import { Store } from "./store.js";
import { HttpError } from "./errors.js";
import {
  modelBody,
  priceBody,
  deviceBody,
  notificationBody,
  sendBody,
  aggregateBody,
} from "./schemas.js";
import { analyze } from "./gemini.js";
import type { CrashQuery } from "./crashlytics.js";
declare module "fastify" {
  interface FastifyRequest {
    identity: Identity | null;
  }
}
type Dependencies = {
  config: Config;
  store: Store;
  verify: VerifyToken;
  send: (
    token: string,
    data: {
      title: string;
      body: string;
      target: string;
      id: string;
      ownerUid: string;
    },
  ) => Promise<void>;
  analyze?: typeof analyze;
  crash?: (query: CrashQuery) => Promise<unknown>;
};
export async function buildApp(d: Dependencies) {
  const { config, store } = d;
  const app = Fastify({
    logger: false,
    bodyLimit: 32768,
    requestTimeout: 45000,
  });
  app.decorateRequest("identity", null);
  await app.register(cors, {
    origin: config.origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
  });
  app.setErrorHandler((error, req, reply) => {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof HttpError
          ? error.statusCode
          : (error as any).statusCode === 429
            ? 429
            : 500;
    const message =
      error instanceof z.ZodError
        ? "Dữ liệu không hợp lệ. Kiểm tra các trường và thử lại."
        : error instanceof HttpError
          ? error.message
          : status === 429
            ? "Thao tác quá nhanh. Hãy thử lại sau."
            : "Chưa hoàn tất yêu cầu. Hãy thử lại.";
    if (status >= 500) {
      void store
        .audit(
          "system",
          "request.error",
          req.routeOptions.url ?? "unknown",
          String(status),
        )
        .catch(() => {});
    }
    reply.code(status).send({ error: message, requestId: req.id });
  });
  app.addHook("preHandler", async (req) => {
    if (req.method === "OPTIONS" || req.routeOptions.url === "/health") return;
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ") || auth.length > 8192)
      throw new HttpError(401, "Đăng nhập Google để tiếp tục.");
    try {
      req.identity = await d.verify(auth.slice(7));
    } catch {
      throw new HttpError(
        401,
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
      );
    }
    if (req.routeOptions.url?.startsWith("/v1/admin/") && !req.identity.admin)
      throw new HttpError(403, "Tài khoản chưa được cấp quyền quản trị.");
  });
  app.get("/health", async () => ({
    status: "ok",
    service: "tokenledger-api",
    version: "0.1.0",
  }));
  app.get("/v1/session", async (req) => ({
    uid: req.identity!.uid,
    email: req.identity!.email,
    admin: req.identity!.admin,
    project: config.FIREBASE_PROJECT_ID,
  }));
  app.get("/v1/admin/status", async () => ({
    project: config.FIREBASE_PROJECT_ID,
    mode: "local",
    database: "Supabase PostgreSQL · dữ liệu vận hành",
    services: {
      firebase: { configured: true },
      fcm: {
        configured: config.FCM_ENABLED === "true" && !!config.credentialPath,
      },
      gemini: {
        configured: config.GEMINI_ENABLED === "true" && !!config.GEMINI_API_KEY,
        model: config.GEMINI_MODEL,
      },
      crashlytics: {
        configured:
          config.CRASHLYTICS_ENABLED === "true" &&
          !!config.FIREBASE_ANDROID_APP_ID,
        reason:
          "Số liệu từ Reports API, cần quyền Firebase Crashlytics Viewer ở backend.",
      },
    },
    counts: await store.summary(),
    checkedAt: new Date().toISOString(),
  }));
  app.get("/v1/admin/crashlytics", async (req) => {
    const query = z
      .object({
        days: z.enum(["7", "30"]).default("7"),
        report: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,100}$/)
          .optional(),
      })
      .strict()
      .parse(req.query);
    if (!d.crash) throw new HttpError(503, "Chưa kết nối báo cáo Crashlytics.");
    return d.crash({
      days: Number(query.days) as 7 | 30,
      report: query.report,
    });
  });
  app.get("/v1/catalog", async () => ({
    models: await store.models(),
    prices: await store.prices(),
  }));
  app.post("/v1/admin/models", async (req) =>
    store.saveModel(modelBody.parse(req.body), req.identity!.uid),
  );
  app.post("/v1/admin/prices", async (req) =>
    store.savePrice(priceBody.parse(req.body), req.identity!.uid),
  );
  app.get("/v1/admin/audit", async () => ({
    events: (await store.rows("audit")).slice(0, 100),
  }));
  app.get("/v1/admin/notification-jobs", async () => ({
    jobs: (await store.rows("jobs")).slice(0, 100),
  }));
  const recipients = async (audience: string, uid: string) => {
    const devices = await store.devices(audience === "self" ? uid : undefined);
    if (devices.length > 500)
      throw new HttpError(400, "Tối đa 500 thiết bị mỗi lượt.");
    return devices;
  };
  app.post("/v1/admin/notification-jobs/preview", async (req) => {
    const draft = notificationBody.parse(req.body);
    return {
      deviceCount: (await recipients(draft.audience, req.identity!.uid)).length,
      draft,
      delivery: "preview_only",
    };
  });
  app.post("/v1/admin/notification-jobs", async (req) => {
    if (config.FCM_ENABLED !== "true")
      throw new HttpError(503, "FCM đang tắt.");
    const { confirmation: _, ...draft } = sendBody.parse(req.body);
    const devices = await recipients(draft.audience, req.identity!.uid);
    if (!devices.length)
      throw new HttpError(409, "Chưa có thiết bị đồng ý nhận thông báo.");
    const claimed = await store.claimJob(draft, req.identity!.uid);
    if (claimed.existing) return claimed.job;
    let accepted = 0,
      failed = 0;
    const owners: string[] = [];
    for (const device of devices) {
      try {
        await d.send(device.token, {
          ...draft,
          id: claimed.job.id,
          ownerUid: device.uid,
        });
        accepted++;
        owners.push(device.uid);
      } catch (e) {
        failed++;
        if (
          [
            "messaging/registration-token-not-registered",
            "messaging/invalid-registration-token",
          ].includes((e as any)?.code)
        )
          await store.removeDevice(device.uid, device.id);
      }
    }
    const job = {
      ...claimed.job,
      status: failed ? (accepted ? "partial" : "failed") : "accepted",
      accepted,
      failed,
      completedAt: new Date().toISOString(),
    };
    await store.finishJob(job, owners);
    await store.audit(
      req.identity!.uid,
      "notification.complete",
      claimed.job.id,
      job.status,
    );
    return job;
  });
  app.put<{ Params: { id: string } }>("/v1/me/devices/:id", async (req) => {
    const id = z
      .string()
      .regex(/^[a-zA-Z0-9_-]{8,128}$/)
      .parse(req.params.id);
    const value = deviceBody.parse(req.body);
    await store.saveDevice(
      req.identity!.uid,
      id,
      value.token,
      createHash("sha256").update(value.token).digest("hex"),
      { platform: value.platform, appVersion: value.appVersion, consent: true },
    );
    return { registered: true };
  });
  app.delete<{ Params: { id: string } }>("/v1/me/devices/:id", async (req) => {
    await store.removeDevice(req.identity!.uid, req.params.id);
    return { removed: true };
  });
  app.get("/v1/me/notifications", async (req) => ({
    notifications: await store.inbox(req.identity!.uid),
  }));
  app.post<{ Params: { id: string } }>(
    "/v1/me/notifications/:id/read",
    async (req) => {
      await store.readInbox(req.identity!.uid, req.params.id);
      return { read: true };
    },
  );
  app.get("/v1/me/analyses", async (req) => ({
    analyses: await store.analyses(req.identity!.uid),
  }));
  app.post(
    "/v1/me/analyses",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
      const value = aggregateBody.parse(req.body);
      const uid = req.identity!.uid;
      if (config.GEMINI_ENABLED !== "true")
        throw new HttpError(503, "Gemini đang tắt.");
      const id = await store.reserveAnalysis(
        uid,
        config.AI_MAX_REQUESTS_PER_USER_DAY,
      );
      try {
        const result = await (d.analyze ?? analyze)(config, value);
        await store.finishAnalysis(id, uid, result);
        return { id, ...result };
      } catch (e) {
        await store.finishAnalysis(id, uid, {
          status: "failed",
          at: new Date().toISOString(),
        });
        throw e;
      }
    },
  );
  app.addHook("onClose", async () => {
    store.close();
  });
  return app;
}
