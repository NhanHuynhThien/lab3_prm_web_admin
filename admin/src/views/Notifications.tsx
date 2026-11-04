import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useState } from "react";
import {
  PaperPlaneTilt,
  Eye,
  DeviceMobile,
  BellSimple,
} from "@phosphor-icons/react";
import { sendJson } from "../api";
import type { Job } from "../types";
import { time } from "../types";
import {
  PageHeading,
  Section,
  Badge,
  Empty,
  ErrorBox,
  Loading,
  useResource,
  Refresh,
} from "../components/ui";
const newDraft = () => ({
  title: "",
  body: "",
  target: "overview",
  audience: "self",
  requestId: crypto.randomUUID(),
});
export function Notifications() {
  const jobs = useResource<{ jobs: Job[] }>("/v1/admin/notification-jobs");
  const [draft, setDraft] = useState(newDraft),
    [preview, setPreview] = useState<{
      deviceCount: number;
      draft: typeof draft;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  function change(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value, requestId: crypto.randomUUID() }));
    setPreview(null);
    setSuccess("");
  }
  async function inspect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(await sendJson("/v1/admin/notification-jobs/preview", draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!preview || !preview.deviceCount) return;
    setBusy(true);
    setError("");
    try {
      const job = await sendJson<Job>("/v1/admin/notification-jobs", {
        ...preview.draft,
        confirmation: "SEND",
      });
      setSuccess(
        `FCM chấp nhận ${job.accepted} thiết bị; ${job.failed} lỗi. Trạng thái chấp nhận không xác nhận đã đọc.`,
      );
      setPreview(null);
      setDraft(newDraft());
      jobs.refresh();
    } catch (e) {
      setError((e as Error).message);
      jobs.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / THÔNG BÁO"
        title="Đúng thông tin. Đúng nơi."
        description="Gửi thông báo vận hành tới thiết bị đã đồng ý nhận."
        action={<Refresh onClick={jobs.refresh} busy={jobs.loading} />}
      />
      <div className="two-column compose-grid">
        <Section
          title="Soạn thông báo"
          detail="Xem trước đối tượng nhận trước khi xác nhận gửi."
        >
          <form className="form-stack" onSubmit={inspect}>
            <label>
              Tiêu đề
              <Input
                required
                maxLength={100}
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="Nội dung thông báo hệ thống"
              />
            </label>
            <label>
              Nội dung
              <Textarea
                required
                rows={4}
                maxLength={500}
                value={draft.body}
                onChange={(e) => change("body", e.target.value)}
                placeholder="Thông tin ngắn gọn để user biết và xử lý."
              />
            </label>
            <div className="form-grid">
              <label>
                Đối tượng
                <NativeSelect
                  value={draft.audience}
                  onChange={(e) => change("audience", e.target.value)}
                >
                  <NativeSelectOption value="self">
                    Thiết bị của tôi
                  </NativeSelectOption>
                  <NativeSelectOption value="all">
                    Tất cả thiết bị đăng ký
                  </NativeSelectOption>
                </NativeSelect>
              </label>
              <label>
                Màn hình khi bấm
                <NativeSelect
                  value={draft.target}
                  onChange={(e) => change("target", e.target.value)}
                >
                  <NativeSelectOption value="overview">
                    Tổng quan
                  </NativeSelectOption>
                  <NativeSelectOption value="accounts">
                    Tài khoản
                  </NativeSelectOption>
                  <NativeSelectOption value="analytics">
                    Phân tích
                  </NativeSelectOption>
                  <NativeSelectOption value="profile">
                    Cá nhân
                  </NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            {error && <ErrorBox message={error} />}
            <Button className="button primary" disabled={busy}>
              <Eye size={20} />
              {busy ? "Đang xử lý…" : "Xem trước"}
            </Button>
          </form>
        </Section>
        <Section
          title="Bản xem trước"
          detail="Chưa gửi tới bất kỳ thiết bị nào."
        >
          <div className="phone-preview">
            <div className="phone-status">
              <span>TokenLedger</span>
              <BellSimple size={20} />
            </div>
            <div className="push-preview">
              <img src="/tokenledger.svg" alt="" />
              <div>
                <strong>{draft.title || "Tiêu đề thông báo"}</strong>
                <p>{draft.body || "Nội dung bạn soạn sẽ hiển thị tại đây."}</p>
                <small>TokenLedger · bây giờ</small>
              </div>
            </div>
          </div>
          {preview && (
            <div className="send-confirm">
              <p>
                <DeviceMobile size={22} />
                <strong>{preview.deviceCount} thiết bị đủ điều kiện</strong>
              </p>
              <p>
                {preview.deviceCount
                  ? "Bạn chuẩn bị gửi thông báo thật. Kiểm tra nội dung và đối tượng trước khi xác nhận."
                  : "Chưa có thiết bị đăng ký. Mở app mobile, đăng nhập và cấp quyền thông báo để kết nối."}
              </p>
              <Button
                className="button primary full"
                type="button"
                disabled={busy || !preview.deviceCount}
                onClick={() => void send()}
              >
                <PaperPlaneTilt />
                {busy ? "Đang gửi…" : "Xác nhận gửi thông báo thật"}
              </Button>
            </div>
          )}
        </Section>
      </div>
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <Section
        title="Lịch sử gửi"
        detail="Số thiết bị được FCM chấp nhận, không phải số lượt đọc."
      >
        {jobs.error ? (
          <ErrorBox message={jobs.error} retry={jobs.refresh} />
        ) : jobs.loading && !jobs.data ? (
          <Loading />
        ) : !jobs.data?.jobs.length ? (
          <Empty
            title="Chưa có lượt gửi nào"
            detail="Soạn thông báo và xem trước để bắt đầu."
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thông báo</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Chấp nhận / lỗi</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data.jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <strong>{j.title}</strong>
                      <small>{j.body}</small>
                    </TableCell>
                    <TableCell>
                      {j.audience === "self"
                        ? "Thiết bị của tôi"
                        : "Tất cả thiết bị"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          j.status === "accepted"
                            ? "green"
                            : j.status === "failed"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {(
                          {
                            accepted: "Đã chấp nhận",
                            sending: "Đang gửi / cần đối chiếu",
                            partial: "Một phần",
                            failed: "Lỗi",
                          } as Record<string, string>
                        )[j.status] || j.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {j.accepted} / {j.failed}
                    </TableCell>
                    <TableCell className="nowrap">
                      {time(j.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </>
  );
}
