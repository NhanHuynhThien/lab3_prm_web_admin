import {
  ArrowSquareOut,
  Bug,
  CheckCircle,
  ClipboardText,
  Cloud,
  Cube,
  CurrencyCircleDollar,
  DeviceMobile,
  PaperPlaneTilt,
  PlugsConnected,
  Sparkle,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { Status, Audit } from "../types";
import { time } from "../types";
import { firebaseConsole } from "../lib/console";
import type { Section as Page } from "../sections";
import {
  useResource,
  PageHeading,
  Section,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Refresh,
  InlineLink,
} from "../components/ui";

/** Services reported by `/v1/admin/status`, in display order. */
const services: {
  key: string;
  name: string;
  icon: Icon;
  detail: (s: Status) => string;
}[] = [
  {
    key: "firebase",
    name: "Firebase Authentication",
    icon: Cloud,
    detail: () => "Xác minh ID token Google ở backend.",
  },
  {
    key: "fcm",
    name: "Firebase Cloud Messaging",
    icon: PaperPlaneTilt,
    detail: () => "Gửi thông báo đẩy tới thiết bị đã đăng ký.",
  },
  {
    key: "gemini",
    name: "Gemini API",
    icon: Sparkle,
    detail: (s) =>
      s.services.gemini?.model
        ? `Model ${s.services.gemini.model}.`
        : "Phân tích khi người dùng yêu cầu.",
  },
  {
    key: "crashlytics",
    name: "Crashlytics",
    icon: Bug,
    detail: (s) => s.services.crashlytics?.reason ?? "Báo cáo lỗi chỉ đọc.",
  },
];

/** Every action the backend writes to `tl_audit`; unknown ones fall back. */
const auditKinds: Record<string, { label: string; icon: Icon }> = {
  "model.create": { label: "Thêm model", icon: Cube },
  "model.update": { label: "Cập nhật model", icon: Cube },
  "price.create": { label: "Tạo phiên bản giá", icon: CurrencyCircleDollar },
  "notification.claim": {
    label: "Bắt đầu gửi thông báo",
    icon: PaperPlaneTilt,
  },
  "notification.complete": { label: "Hoàn tất lượt gửi", icon: CheckCircle },
  "request.error": { label: "Lỗi máy chủ", icon: WarningCircle },
};
const auditKind = (action: string) =>
  Object.hasOwn(auditKinds, action)
    ? auditKinds[action]
    : { label: action, icon: ClipboardText };

/** Rows shown here; the API returns up to 100. */
const recentAuditCount = 6;

export function Overview({ navigate }: { navigate: (p: Page) => void }) {
  const state = useResource<Status>("/v1/admin/status");
  const audit = useResource<{ events: Audit[] }>("/v1/admin/audit");
  const s = state.data;
  const configured = s
    ? services.filter(({ key }) => s.services[key]?.configured).length
    : 0;
  return (
    <>
      <PageHeading
        title="Tổng quan vận hành"
        description="Thiết bị, dịch vụ và nhật ký của TokenLedger."
        action={
          <Refresh
            onClick={() => {
              state.refresh();
              audit.refresh();
            }}
            busy={state.loading}
          />
        }
      />
      {state.error && <ErrorBox message={state.error} retry={state.refresh} />}
      {!s && state.loading ? (
        <Loading />
      ) : (
        s && (
          <>
            <div className="stats-grid three">
              {[
                {
                  icon: DeviceMobile,
                  label: "Thiết bị đăng ký",
                  value: s.counts.devices,
                  note: "Đã đồng ý nhận thông báo",
                },
                {
                  icon: PlugsConnected,
                  label: "Dịch vụ đã cấu hình",
                  value: `${configured}/${services.length}`,
                  note: "Cấu hình, chưa phải kiểm thử end-to-end",
                },
                {
                  icon: ClipboardText,
                  label: "Sự kiện nhật ký",
                  value: s.counts.auditEvents,
                  note: "Do backend ghi nhận",
                },
              ].map(({ icon: I, label, value, note }) => (
                <article className="stat" key={label}>
                  <span className="stat-icon">
                    <I size={22} />
                  </span>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </div>
            <div className="two-column">
              <Section title="Dịch vụ">
                <div className="service-list">
                  {services.map(({ key, name, icon: I, detail }) => {
                    const ready = s.services[key]?.configured;
                    return (
                      <div className="service-line" key={key}>
                        <span>
                          <I size={20} className={ready ? "" : "warn"} />
                          <span>
                            {name}
                            <small>{detail(s)}</small>
                          </span>
                        </span>
                        <Badge tone={ready ? "green" : "amber"}>
                          {ready ? "Đã cấu hình" : "Cần thiết lập"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                <InlineLink onClick={() => navigate("crashlytics")}>
                  Mở báo cáo Crashlytics
                </InlineLink>
              </Section>
              <Section title="Dự án">
                <dl className="facts">
                  <div>
                    <dt>Project</dt>
                    <dd>{s.project}</dd>
                  </div>
                  <div>
                    <dt>Môi trường</dt>
                    <dd>{s.mode}</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>{s.database}</dd>
                  </div>
                  <div>
                    <dt>Lần kiểm cấu hình</dt>
                    <dd>{time(s.checkedAt)}</dd>
                  </div>
                </dl>
                <Button className="button secondary console-action" asChild>
                  <a
                    href={firebaseConsole(s.project)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở Firebase Console
                    <ArrowSquareOut size={18} />
                  </a>
                </Button>
              </Section>
            </div>
          </>
        )
      )}
      <Section title="Nhật ký gần đây">
        {audit.error ? (
          <ErrorBox message={audit.error} retry={audit.refresh} />
        ) : audit.loading && !audit.data ? (
          <Loading />
        ) : !audit.data?.events.length ? (
          <Empty
            title="Chưa có sự kiện"
            detail="Lỗi máy chủ và thao tác quản trị qua API sẽ xuất hiện tại đây."
          />
        ) : (
          <div className="audit-list">
            {audit.data.events.slice(0, recentAuditCount).map((a) => {
              const { label, icon: I } = auditKind(a.action);
              return (
                <div className="audit-row" key={a.id}>
                  <span className="audit-icon">
                    <I size={18} />
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <small>{a.target}</small>
                    <time>{time(a.at)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
