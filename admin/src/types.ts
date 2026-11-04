export type Model = {
  id: string;
  provider: "openai" | "anthropic" | "google" | "other";
  name: string;
  status: "active" | "paused" | "deprecated";
  description: string;
  revision: number;
  updatedAt: string;
};
export type Price = {
  id: string;
  modelId: string;
  inputMicros: number;
  outputMicros: number;
  cacheMicros: number | null;
  effectiveFrom: string;
  sourceUrl: string;
  createdAt: string;
};
export type Catalog = { models: Model[]; prices: Price[] };
export type Job = {
  id: string;
  title: string;
  body: string;
  target: string;
  audience: string;
  status: string;
  accepted: number;
  failed: number;
  createdAt: string;
};
export type Service = { configured: boolean; model?: string; reason?: string };
export type Status = {
  project: string;
  mode: string;
  database: string;
  services: Record<string, Service>;
  counts: {
    models: number;
    prices: number;
    devices: number;
    jobs: number;
    auditEvents: number;
  };
  checkedAt: string;
};
export type Audit = {
  id: string;
  action: string;
  target: string;
  outcome: string;
  at: string;
};
export const providers = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  other: "Khác",
};
export const modelStatuses = {
  active: "Đang hỗ trợ",
  paused: "Tạm dừng",
  deprecated: "Ngừng hỗ trợ",
};
export const money = (v: number | null) =>
  v == null
    ? "Chưa có"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 6,
      }).format(v / 1e6);
export const time = (v: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
