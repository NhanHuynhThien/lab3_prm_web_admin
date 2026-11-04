import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Presence/shape check only: no network, no model call, no secret output.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parse = (text) =>
  Object.fromEntries(
    text.split(/\r?\n/).flatMap((line) => {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      return m ? [[m[1], m[2].trim().replace(/^(["'])(.*)\1$/, "$2")]] : [];
    }),
  );
let missing = false;
for (const name of ["backend", "admin"]) {
  let config;
  try {
    config = parse(
      await readFile(
        resolve(root, name === "backend" ? "api" : "admin", ".env"),
        "utf8",
      ),
    );
  } catch {
    console.log(`${name}: local configuration missing`);
    missing = true;
    continue;
  }
  const required =
    name === "backend"
      ? [
          "FIREBASE_PROJECT_ID",
          "GEMINI_API_KEY",
          "GEMINI_MODEL",
          "SUPABASE_URL",
          "SUPABASE_SECRET_KEY",
          "DEVICE_ENCRYPTION_KEY",
        ]
      : [
          "NEXT_PUBLIC_API_BASE_URL",
          "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
          "NEXT_PUBLIC_FIREBASE_API_KEY",
          "NEXT_PUBLIC_FIREBASE_APP_ID",
        ];
  for (const key of required) {
    const present =
      Boolean(config[key]) &&
      (key !== "SUPABASE_SECRET_KEY" || config[key].length >= 30) &&
      (key !== "DEVICE_ENCRYPTION_KEY" || /^[a-f0-9]{64}$/.test(config[key]));
    console.log(
      `${name}.${key}: ${present ? "configured (not verified)" : "missing"}`,
    );
    if (!present) missing = true;
  }
  const uploadOff = name === "admin" || config.PDF_UPLOAD_ENABLED === "false";
  console.log(
    `${name}.pdf_upload: ${uploadOff ? "disabled" : "must be disabled"}`,
  );
  if (!uploadOff) missing = true;
  if (name === "backend") {
    let identityValid = false;
    try {
      if (!config.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("missing");
      const path = resolve(root, "api", config.GOOGLE_APPLICATION_CREDENTIALS);
      const identity = JSON.parse(await readFile(path, "utf8"));
      const mode = (await stat(path)).mode & 0o777;
      identityValid =
        identity.project_id === config.FIREBASE_PROJECT_ID &&
        identity.client_email ===
          `tokenledger-fcm-dev@${config.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com` &&
        identity.type === "service_account" &&
        mode === 0o600;
    } catch {
      /* values deliberately suppressed */
    }
    console.log(
      `backend.fcm_identity: ${identityValid ? "configured; project/identity/mode valid" : "missing or invalid"}`,
    );
    if (config.FCM_ENABLED === "true" && !identityValid) missing = true;
    console.log(
      `backend.fcm: ${config.FCM_ENABLED === "true" ? "configured; real delivery not verified" : "disabled"}`,
    );
    console.log(
      `backend.gemini: ${config.GEMINI_ENABLED === "true" ? "configured; generation not verified" : "disabled"}`,
    );
  }
  if (
    name === "admin" &&
    Object.keys(config).some((k) =>
      /SECRET|PRIVATE|GEMINI|SERVICE_ACCOUNT/.test(k),
    )
  ) {
    console.log(
      "admin: prohibited server credential variable found (values suppressed)",
    );
    missing = true;
  }
}
process.exitCode = missing ? 1 : 0;
