import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
export const platformRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export function readConfig() {
  const file = resolve(platformRoot, "api/.env");
  const values = Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        return m ? [[m[1], m[2].trim()]] : [];
      }),
  );
  const cfg = z
    .object({
      HOST: z.enum(["127.0.0.1", "localhost"]).default("127.0.0.1"),
      PORT: z.coerce.number().int().min(1024).max(65535).default(8788),
      SUPABASE_URL: z.url().refine((v) => v.startsWith("https://")),
      SUPABASE_SECRET_KEY: z.string().min(20),
      FIREBASE_PROJECT_ID: z.string().regex(/^[a-z][a-z0-9-]{4,62}$/),
      GOOGLE_APPLICATION_CREDENTIALS: z.string().default(""),
      GEMINI_API_KEY: z.string().default(""),
      GEMINI_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/),
      GEMINI_ENABLED: z.enum(["true", "false"]).default("false"),
      CRASHLYTICS_ENABLED: z.enum(["true", "false"]).default("false"),
      FIREBASE_ANDROID_APP_ID: z.string().default(""),
      FCM_ENABLED: z.enum(["true", "false"]).default("false"),
      ADMIN_UIDS: z.string().default(""),
      ADMIN_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
      DEVICE_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
      AI_MAX_REQUESTS_PER_USER_DAY: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10),
      AI_MAX_OUTPUT_TOKENS: z.coerce
        .number()
        .int()
        .min(128)
        .max(4096)
        .default(1024),
      AI_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(60000)
        .default(30000),
    })
    .parse(values);
  return {
    ...cfg,
    adminUids: new Set(
      cfg.ADMIN_UIDS.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
    origins: cfg.ADMIN_ALLOWED_ORIGINS.split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    credentialPath: cfg.GOOGLE_APPLICATION_CREDENTIALS
      ? resolve(platformRoot, "api", cfg.GOOGLE_APPLICATION_CREDENTIALS)
      : "",
  };
}
export type Config = ReturnType<typeof readConfig>;
