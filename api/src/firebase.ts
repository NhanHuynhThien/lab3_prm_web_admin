import { initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { readFileSync } from "node:fs";
import type { Config } from "./config.js";
export type Identity = { uid: string; email: string | null; admin: boolean };
export type VerifyToken = (token: string) => Promise<Identity>;
export function firebaseServices(config: Config) {
  let credential;
  if (config.credentialPath) {
    const json = JSON.parse(readFileSync(config.credentialPath, "utf8"));
    if (
      json.project_id !== config.FIREBASE_PROJECT_ID ||
      json.client_email !==
        `tokenledger-fcm-dev@${config.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`
    )
      throw new Error("FCM identity does not match expected project/account.");
    credential = cert(json);
  }
  const app: App = initializeApp(
    {
      projectId: config.FIREBASE_PROJECT_ID,
      ...(credential ? { credential } : {}),
    },
    "tokenledger-platform",
  );
  const verify: VerifyToken = async (token) => {
    const user = await getAuth(app).verifyIdToken(token);
    if (
      user.email_verified !== true ||
      user.firebase.sign_in_provider !== "google.com"
    )
      throw new Error("Google sign in required.");
    return {
      uid: user.uid,
      email: user.email ?? null,
      admin: user.admin === true || config.adminUids.has(user.uid),
    };
  };
  return {
    verify,
    crashAccessToken: async () => {
      const token = await app.options.credential!.getAccessToken();
      return token.access_token;
    },
    send: async (
      token: string,
      data: {
        title: string;
        body: string;
        target: string;
        id: string;
        ownerUid: string;
      },
    ) => {
      await getMessaging(app).send({
        token,
        notification: { title: data.title, body: data.body },
        data: {
          route: `/${data.target}`,
          notificationId: data.id,
          ownerUid: data.ownerUid,
        },
        android: { priority: "high", ttl: 86400000 },
      });
    },
  };
}
