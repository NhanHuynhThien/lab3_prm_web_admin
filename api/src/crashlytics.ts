import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
export type CrashQuery = { days: 7 | 30; report?: string };
export type CrashRow = {
  id: string;
  title: string;
  type: string;
  events: number | null;
  users: number | null;
  sessions: number | null;
  crashFreeUsers: number | null;
  lastSeen: string | null;
  url: string;
};
const count = (v: unknown) => {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const percent = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
const safeText = (v: unknown) =>
  String(v ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(
      /\b(?:sb_secret_|AIza|AQ\.|ya29\.)[A-Za-z0-9_.-]+/g,
      "[credential]",
    )
    .replace(/Bearer\s+\S+/gi, "[credential]")
    .slice(0, 180);
export function crashRows(raw: unknown, consoleUrl: string): CrashRow[] {
  const report = raw as any;
  if (!Array.isArray(report?.groups)) return [];
  return report.groups.slice(0, 25).map((group: any, i: number) => {
    const metric = Array.isArray(group.metrics) ? (group.metrics[0] ?? {}) : {};
    const issue = group.issue ?? {};
    // Explicit projection: never expose user IDs, events, custom keys, logs or exception messages.
    return {
      id: safeText(issue.id ?? i),
      title: safeText(
        issue.title ??
          group.version?.displayName ??
          group.device?.displayName ??
          group.operatingSystem?.displayName ??
          "Nhóm thống kê",
      ),
      type: ["FATAL", "NON_FATAL", "ANR"].includes(issue.errorType)
        ? issue.errorType
        : "OTHER",
      events: count(metric.eventsCount),
      users: count(metric.impactedUsersCount),
      sessions: count(metric.impactedSessionsCount),
      crashFreeUsers: percent(metric.crashFreeUsersPercentage),
      lastSeen:
        typeof issue.lastSeenTime === "string" ? issue.lastSeenTime : null,
      url: consoleUrl,
    };
  });
}
export class CrashlyticsReader {
  private cache = new Map<string, { at: number; value: any }>();
  constructor(
    private c: Config,
    private token: () => Promise<string>,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async get(path: string) {
    let token: string;
    try {
      token = await this.token();
    } catch {
      throw new HttpError(503, "Chưa lấy được identity cho Crashlytics.");
    }
    let response: Response;
    try {
      response = await this.fetcher(
        `https://firebasecrashlytics.googleapis.com/v1alpha/${path}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new HttpError(504, "Crashlytics phản hồi chậm. Hãy thử lại sau.");
    }
    if (response.status === 403)
      throw new HttpError(
        503,
        "Backend chưa có quyền đọc báo cáo Crashlytics hoặc API chưa được bật.",
      );
    if (!response.ok)
      throw new HttpError(
        503,
        "Chưa lấy được báo cáo Crashlytics từ Firebase.",
      );
    const text = await response.text();
    if (text.length > 1000000)
      throw new HttpError(502, "Báo cáo Crashlytics vượt giới hạn.");
    return JSON.parse(text);
  }
  async read(query: CrashQuery) {
    if (
      this.c.CRASHLYTICS_ENABLED !== "true" ||
      !this.c.FIREBASE_ANDROID_APP_ID
    )
      return {
        configured: false,
        reason: "Chưa bật quyền đọc báo cáo Crashlytics cho backend.",
        reports: [],
        rows: [],
        checkedAt: new Date().toISOString(),
      };
    const key = JSON.stringify(query),
      cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 60000) return cached.value;
    const parent = `projects/${this.c.FIREBASE_PROJECT_ID}/apps/${encodeURIComponent(this.c.FIREBASE_ANDROID_APP_ID)}`;
    const projectNumber = this.c.FIREBASE_ANDROID_APP_ID.split(":")[1];
    const allowedParents = [this.c.FIREBASE_PROJECT_ID, projectNumber].map(
      (p) => `projects/${p}/apps/${this.c.FIREBASE_ANDROID_APP_ID}/reports/`,
    );
    const metadata = await this.get(`${parent}/reports`);
    const reports = (Array.isArray(metadata.reports) ? metadata.reports : [])
      .filter(
        (r: any) =>
          typeof r.name === "string" &&
          allowedParents.some((p) => r.name.startsWith(p)),
      )
      .map((r: any) => ({
        id: r.name.split("/").at(-1),
        name: safeText(r.displayName ?? r.name.split("/").at(-1)),
      }))
      .filter((r: any) => /^[A-Za-z0-9_-]{1,100}$/.test(r.id));
    const selected =
      reports.find((r: any) => r.id === query.report) ??
      reports.find((r: any) => /issue/i.test(r.id)) ??
      reports[0];
    const end = new Date(),
      start = new Date(end.getTime() - query.days * 86400000),
      consoleUrl = `https://console.firebase.google.com/project/${this.c.FIREBASE_PROJECT_ID}/crashlytics/app/android:com.tokenledger.token_ledger/issues`;
    if (!selected)
      return {
        configured: true,
        reports: [],
        rows: [],
        checkedAt: end.toISOString(),
        start: start.toISOString(),
        end: end.toISOString(),
        source: "Firebase Crashlytics Reports API",
        totalGroups: null,
        hasMore: false,
      };
    const params = new URLSearchParams({
      "filter.interval.startTime": start.toISOString(),
      "filter.interval.endTime": end.toISOString(),
      pageSize: "25",
      view: "REPORT_VIEW_FULL",
      metricsMode: "METRICS_MODE_OBSERVED",
      granularity: "TIME_GRANULARITY_NONE",
    });
    const raw = await this.get(`${parent}/reports/${selected.id}?${params}`);
    const value = {
      configured: true,
      reports,
      selected: selected.id,
      rows: crashRows(raw, consoleUrl),
      totalGroups: count(raw.totalSize),
      hasMore: !!raw.nextPageToken,
      start: start.toISOString(),
      end: end.toISOString(),
      checkedAt: end.toISOString(),
      source: "Firebase Crashlytics Reports API · observed",
      consoleUrl,
    };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }
}
