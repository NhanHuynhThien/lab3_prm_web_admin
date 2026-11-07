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
export const time = (v: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
