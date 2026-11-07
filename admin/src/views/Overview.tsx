import {
  Bug,
  ChartLineUp,
  CheckCircle,
  ClipboardText,
  Clock,
  DeviceMobile,
  PlugsConnected,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Status, Audit } from "../types";
import { time } from "../types";
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
const services = [
  ["Firebase", "firebase"],
  ["Firebase Cloud Messaging", "fcm"],
  ["Gemini API", "gemini"],
  ["Crashlytics", "crashlytics"],
];
const auditNames: Record<string, string> = {
  "model.create": "Thêm model",
  "model.update": "Cập nhật model",
  "price.create": "Tạo phiên bản giá",
  "notification.claim": "Bắt đầu gửi thông báo",
  "notification.complete": "Hoàn tất lượt gửi",
};
export function Overview({ navigate }: { navigate: (p: string) => void }) {
  const state = useResource<Status>("/v1/admin/status");
  const audit = useResource<{ events: Audit[] }>("/v1/admin/audit");
  const s = state.data;
  const configured = s
    ? services.filter(([, key]) => s.services[key]?.configured).length
    : 0;
  return (
    <>
      <PageHeading
        title="Tổng quan vận hành"
        description="Thiết bị, dịch vụ và hoạt động quản trị của TokenLedger."
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
      {state.error && <ErrorBox message={state.error} retry={state.refresh} />}{" "}
      {!s && state.loading ? (
        <Loading />
      ) : (
        s && (
          <>
            <div className="overview-banner">
              <div>
                <Badge tone="green">Môi trường local</Badge>
                <h2>Workspace đã kết nối</h2>
                <p>
                  {s.project} · Dữ liệu vận hành lưu trong Supabase PostgreSQL.
                </p>
              </div>
              <ChartLineUp size={74} weight="thin" />
            </div>
            <div className="stats-grid three">
              {[
                [
                  DeviceMobile,
                  "Thiết bị đăng ký",
                  s.counts.devices,
                  "Đã đồng ý nhận thông báo",
                ],
                [
                  PlugsConnected,
                  "Dịch vụ đã cấu hình",
                  `${configured}/${services.length}`,
                  "Chưa phải bằng chứng end-to-end",
                ],
                [
                  ClipboardText,
                  "Sự kiện nhật ký",
                  s.counts.auditEvents,
                  "Do backend ghi nhận",
                ],
              ].map(([Icon, label, value, note]) => {
                const I = Icon as typeof Bug;
                return (
                  <article className="stat" key={String(label)}>
                    <div className="stat-top">
                      <I size={22} />
                    </div>
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                    <small>{String(note)}</small>
                  </article>
                );
              })}
            </div>
            <div className="two-column">
              <Section
                title="Kết nối dịch vụ"
                detail="Trạng thái cấu hình, không thay bằng chứng end-to-end."
              >
                <div className="service-list">
                  {services.map(([name, key]) => {
                    const ready = s.services[key]?.configured;
                    return (
                      <div className="service-line" key={key}>
                        <span>
                          {ready ? (
                            <CheckCircle size={20} />
                          ) : (
                            <WarningCircle size={20} className="warn" />
                          )}
                          {name}
                        </span>
                        <Badge tone={ready ? "green" : "amber"}>
                          {ready ? "Đã cấu hình" : "Cần thiết lập"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                <InlineLink onClick={() => navigate("system")}>
                  Xem chi tiết hệ thống
                </InlineLink>
              </Section>
              <Section
                title="Sự cố ứng dụng"
                detail="Báo cáo chỉ đọc từ Firebase Crashlytics."
              >
                <div className="feature-illustration">
                  <Bug size={46} weight="thin" />
                  <div>
                    <h3>
                      {s.services.crashlytics?.configured
                        ? "Đã kết nối báo cáo"
                        : "Chưa kết nối báo cáo"}
                    </h3>
                    <p>
                      {s.services.crashlytics?.reason ||
                        "Xem nhóm lỗi, số sự kiện và thời điểm gần nhất."}
                    </p>
                  </div>
                </div>
                <InlineLink onClick={() => navigate("crashlytics")}>
                  Mở báo cáo Crashlytics
                </InlineLink>
              </Section>
            </div>
          </>
        )
      )}
      <Section
        title="Nhật ký gần đây"
        detail="Các thao tác quản trị được ghi nhận từ backend."
      >
        {audit.error ? (
          <ErrorBox message={audit.error} retry={audit.refresh} />
        ) : audit.loading && !audit.data ? (
          <Loading />
        ) : !audit.data?.events.length ? (
          <Empty
            title="Chưa có hoạt động quản trị"
            detail="Khi có thao tác quản trị, nhật ký sẽ xuất hiện tại đây."
          />
        ) : (
          <div className="audit-list">
            {audit.data.events.slice(0, 6).map((a) => (
              <div className="audit-row" key={a.id}>
                <Clock size={20} />
                <div>
                  <strong>{auditNames[a.action] || a.action}</strong>
                  <small>{a.target}</small>
                  <time>{time(a.at)}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
