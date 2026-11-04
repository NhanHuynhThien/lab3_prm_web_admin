import {
  BellSimple,
  ChartLineUp,
  Cube,
  DeviceMobile,
  ArrowUpRight,
  CheckCircle,
  Clock,
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
export function Overview({ navigate }: { navigate: (p: string) => void }) {
  const state = useResource<Status>("/v1/admin/status");
  const audit = useResource<{ events: Audit[] }>("/v1/admin/audit");
  const s = state.data;
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / TỔNG QUAN"
        title="Vận hành, trong tầm nhìn."
        description="Danh mục, thiết bị và thông báo của hệ thống TokenLedger."
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
            <div className="stats-grid">
              {[
                [
                  Cube,
                  "Model trong danh mục",
                  s.counts.models,
                  "Quản lý tại Danh mục",
                ],
                [
                  ChartLineUp,
                  "Phiên bản bảng giá",
                  s.counts.prices,
                  "Lịch sử giá được giữ lại",
                ],
                [
                  DeviceMobile,
                  "Thiết bị đăng ký",
                  s.counts.devices,
                  "Đã đồng ý nhận thông báo",
                ],
                [
                  BellSimple,
                  "Lượt gửi thông báo",
                  s.counts.jobs,
                  "Gồm trạng thái gửi và lỗi",
                ],
              ].map(([Icon, label, value, note]) => {
                const I = Icon as typeof Cube;
                return (
                  <article className="stat" key={String(label)}>
                    <div className="stat-top">
                      <I size={22} />
                      <ArrowUpRight size={17} />
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
                title="Bắt đầu từ danh mục"
                detail="Quản lý thông tin model và nguồn giá để user đối chiếu."
              >
                <div className="feature-illustration">
                  <Cube size={46} weight="thin" />
                  <div>
                    <h3>
                      {s.counts.models
                        ? "Danh mục đang được quản lý"
                        : "Chưa có model nào"}
                    </h3>
                    <p>
                      {s.counts.models
                        ? "Mỗi lần cập nhật đều có revision và nhật ký."
                        : "Thêm model đầu tiên với provider và trạng thái thực tế."}
                    </p>
                  </div>
                </div>
                <InlineLink onClick={() => navigate("catalog")}>
                  Mở danh mục model
                </InlineLink>
              </Section>
              <Section
                title="Kết nối dịch vụ"
                detail="Trạng thái cấu hình, không thay bằng chứng end-to-end."
              >
                <div className="service-list">
                  {[
                    ["Firebase", "firebase"],
                    ["Firebase Cloud Messaging", "fcm"],
                    ["Gemini API", "gemini"],
                  ].map(([name, key]) => (
                    <div className="service-line" key={key}>
                      <span>
                        <CheckCircle size={20} />
                        {name}
                      </span>
                      <Badge
                        tone={s.services[key]?.configured ? "green" : "amber"}
                      >
                        {s.services[key]?.configured
                          ? "Đã cấu hình"
                          : "Cần thiết lập"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <InlineLink onClick={() => navigate("system")}>
                  Xem chi tiết hệ thống
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
            detail="Khi bạn thêm model, bảng giá hoặc gửi thông báo, nhật ký sẽ xuất hiện tại đây."
          />
        ) : (
          <div className="audit-list">
            {audit.data.events.slice(0, 6).map((a) => (
              <div className="audit-row" key={a.id}>
                <Clock size={20} />
                <div>
                  <strong>
                    {(
                      {
                        "model.create": "Thêm model",
                        "model.update": "Cập nhật model",
                        "price.create": "Tạo phiên bản giá",
                        "notification.claim": "Bắt đầu gửi thông báo",
                        "notification.complete": "Hoàn tất lượt gửi",
                      } as Record<string, string>
                    )[a.action] || a.action}
                  </strong>
                  <small>{a.target}</small>
                </div>
                <time>{time(a.at)}</time>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
