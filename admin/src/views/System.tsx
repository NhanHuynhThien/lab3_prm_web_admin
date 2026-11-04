import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Cloud,
  Lightning,
  WarningCircle,
  LockSimple,
  HardDrives,
} from "@phosphor-icons/react";
import type { Status } from "../types";
import { time } from "../types";
import {
  PageHeading,
  Section,
  Badge,
  ErrorBox,
  Loading,
  Refresh,
  useResource,
} from "../components/ui";
export function System() {
  const state = useResource<Status>("/v1/admin/status");
  const s = state.data;
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / HỆ THỐNG"
        title="Biết rõ trạng thái hiện tại."
        description="Cấu hình dịch vụ và giới hạn dữ liệu được thể hiện riêng."
        action={<Refresh onClick={state.refresh} busy={state.loading} />}
      />
      {state.error && <ErrorBox message={state.error} retry={state.refresh} />}{" "}
      {!s && state.loading ? (
        <Loading />
      ) : (
        s && (
          <>
            <div className="system-grid">
              {[
                [
                  "Firebase Authentication",
                  "firebase",
                  Cloud,
                  "Xác minh ID token Google tại backend trước mỗi request.",
                ],
                [
                  "Firebase Cloud Messaging",
                  "fcm",
                  Lightning,
                  "Backend dùng identity chỉ có quyền FCM. Kết quả gửi không đồng nghĩa thiết bị đã đọc.",
                ],
                [
                  "Gemini API",
                  "gemini",
                  Lightning,
                  `Model cấu hình: ${s.services.gemini.model}. Chỉ phân tích khi user chủ động yêu cầu.`,
                ],
                [
                  "Crashlytics",
                  "crashlytics",
                  WarningCircle,
                  s.services.crashlytics.reason || "Chưa có dữ liệu export.",
                ],
              ].map(([title, key, Icon, detail]) => {
                const I = Icon as typeof Cloud;
                const service = s.services[String(key)];
                return (
                  <section className="panel service-card" key={String(key)}>
                    <div className="service-card-head">
                      <span className="icon-tile">
                        <I size={26} />
                      </span>
                      <Badge tone={service.configured ? "green" : "amber"}>
                        {service.configured ? "Đã cấu hình" : "Chưa kết nối"}
                      </Badge>
                    </div>
                    <h2>{String(title)}</h2>
                    <p>{String(detail)}</p>
                    {key === "crashlytics" && (
                      <Button className="button secondary" asChild>
                        <Link href="/crashlytics">Mở báo cáo Crashlytics</Link>
                      </Button>
                    )}
                    <small>
                      Không gọi dịch vụ hoặc tạo tác vụ khi chỉ mở màn này.
                    </small>
                  </section>
                );
              })}
            </div>
            <div className="two-column">
              <Section
                title="Ranh giới dữ liệu"
                detail="Giữ đúng vai trò của admin."
              >
                <div className="notice">
                  <LockSimple size={24} />
                  <p>
                    Workspace chỉ quản lý dữ liệu vận hành. Không đọc nội dung
                    chat, lịch sử token hoặc báo cáo riêng của user trong
                    Firestore.
                  </p>
                </div>
                <dl className="facts">
                  <div>
                    <dt>Project</dt>
                    <dd>{s.project}</dd>
                  </div>
                  <div>
                    <dt>Môi trường</dt>
                    <dd>Backend local · DB Supabase</dd>
                  </div>
                  <div>
                    <dt>Lần kiểm cấu hình</dt>
                    <dd>{time(s.checkedAt)}</dd>
                  </div>
                </dl>
              </Section>
              <Section
                title="Database vận hành"
                detail="Dữ liệu thực, không có bản ghi demo."
              >
                <div className="feature-illustration">
                  <HardDrives size={38} />
                  <div>
                    <h3>Supabase PostgreSQL</h3>
                    <p>
                      Danh mục, phiên bản giá, nhật ký và lượt gửi được giữ qua
                      lần khởi động lại backend.
                    </p>
                  </div>
                </div>
                <p>
                  Token thiết bị mã hóa AES-256-GCM. Secret và dữ liệu local
                  không thuộc Git.
                </p>
                <div className="notice subtle">
                  <CheckCircle size={22} />
                  <p>
                    Upload PDF đã bỏ khỏi scope. PDF cục bộ vẫn thuộc app
                    mobile.
                  </p>
                </div>
              </Section>
            </div>
          </>
        )
      )}
    </>
  );
}
