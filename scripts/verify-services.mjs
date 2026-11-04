import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

// Explicit setup verification: model listing and FCM validate_only, never generation/push delivery.
const configDir = resolve(dirname(fileURLToPath(import.meta.url)), "../api");
const config = Object.fromEntries(
  (await readFile(resolve(configDir, ".env"), "utf8"))
    .split(/\r?\n/)
    .flatMap((line) => {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      return m ? [[m[1], m[2].trim()]] : [];
    }),
);
const output = {
  checkedAt: new Date().toISOString(),
  generationPerformed: false,
  pushDelivered: false,
  billingChanged: false,
};
let failed = false;
async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, status: response.status, body: await response.json() };
}
try {
  if (!config.GEMINI_API_KEY) throw new Error("missing");
  const value = await request(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: { "x-goog-api-key": config.GEMINI_API_KEY },
    },
  );
  const model = `models/${config.GEMINI_MODEL}`;
  const supported =
    value.ok &&
    value.body.models?.some(
      (m) =>
        m.name === model &&
        m.supportedGenerationMethods?.includes("generateContent"),
    );
  output.gemini = {
    modelList: value.ok,
    httpStatus: value.status,
    configuredModelAvailable: Boolean(supported),
  };
  if (!supported) failed = true;
} catch {
  output.gemini = {
    modelList: false,
    failure: "missing_configuration_or_transport",
  };
  failed = true;
}
try {
  if (!config.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("missing");
  const identity = JSON.parse(
    await readFile(
      resolve(configDir, config.GOOGLE_APPLICATION_CREDENTIALS),
      "utf8",
    ),
  );
  const expected = `tokenledger-fcm-dev@${config.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`;
  if (
    identity.project_id !== config.FIREBASE_PROJECT_ID ||
    identity.client_email !== expected ||
    identity.type !== "service_account"
  )
    throw new Error("identity mismatch");
  const now = Math.floor(Date.now() / 1000);
  const base64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${base64({ alg: "RS256", typ: "JWT" })}.${base64({
    iss: identity.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(identity.private_key, "base64url")}`;
  const auth = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!auth.ok || !auth.body.access_token) {
    output.fcm = {
      identityVerified: true,
      oauthToken: false,
      httpStatus: auth.status,
    };
    failed = true;
  } else {
    const dryRun = await request(
      `https://fcm.googleapis.com/v1/projects/${config.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.body.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          validate_only: true,
          message: {
            topic: "tokenledger-setup-validation",
            data: { type: "setup_validation" },
          },
        }),
      },
    );
    output.fcm = {
      identityVerified: true,
      oauthToken: true,
      validateOnly: dryRun.ok,
      httpStatus: dryRun.status,
    };
    if (!dryRun.ok) failed = true;
  }
} catch {
  output.fcm = {
    validateOnly: false,
    failure: "missing_configuration_or_transport",
  };
  failed = true;
}
console.log(JSON.stringify(output, null, 2));
process.exitCode = failed ? 1 : 0;
