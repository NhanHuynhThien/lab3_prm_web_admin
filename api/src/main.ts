import { readConfig } from "./config.js";
import { Store } from "./store.js";
import { firebaseServices } from "./firebase.js";
import { CrashlyticsReader } from "./crashlytics.js";
import { buildApp } from "./app.js";
try {
  const config = readConfig();
  const services = firebaseServices(config);
  const store = new Store(
    config.SUPABASE_URL,
    config.SUPABASE_SECRET_KEY,
    config.DEVICE_ENCRYPTION_KEY,
  );
  const crash = new CrashlyticsReader(config, services.crashAccessToken);
  const app = await buildApp({
    config,
    store,
    ...services,
    crash: (query) => crash.read(query),
  });
  await app.listen({ host: config.HOST, port: config.PORT });
  console.log(
    `TokenLedger API running locally on http://${config.HOST}:${config.PORT}`,
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
} catch {
  console.error(
    "API startup failed. Check local configuration and port availability. Secret values are suppressed.",
  );
  process.exitCode = 1;
}
