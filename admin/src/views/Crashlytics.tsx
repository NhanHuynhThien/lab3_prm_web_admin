import { useState } from "react";
import {
  ArrowSquareOut,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import {
  PageHeading,
  Section,
  Badge,
  Empty,
  ErrorBox,
  Loading,
  Refresh,
  useResource,
} from "../components/ui";
import { time } from "../types";
type Row = {
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
type Data = {
  configured: boolean;
  reason?: string;
  reports: { id: string; name: string }[];
  selected?: string;
  rows: Row[];
  totalGroups: number | null;
  hasMore: boolean;
  start?: string;
  end?: string;
  checkedAt: string;
  source?: string;
  consoleUrl?: string;
};
const consoleUrl =
  "https://console.firebase.google.com/project/tokenledger-nhan-20261021/crashlytics/app/android:com.tokenledger.token_ledger/issues";
const value = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("vi-VN").format(n);
const kinds: Record<string, string> = {
  FATAL: "Crash",
  NON_FATAL: "Lỗi có xử lý",
  ANR: "Không phản hồi",
  OTHER: "Nhóm thống kê",
};
export function Crashlytics() {
  const [days, setDays] = useState("7"),
    [report, setReport] = useState("");
  const query = new URLSearchParams({ days, ...(report ? { report } : {}) });
  const state = useResource<Data>(`/v1/admin/crashlytics?${query}`),
    data = state.data;
  const rows = data?.rows ?? [];
  const events =
    rows.length && rows.every((r) => r.events !== null)
      ? rows.reduce((n, r) => n + r.events!, 0)
      : rows.length
        ? null
        : 0;
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / CRASHLYTICS"
        title="Sự cố, có bằng chứng."
        description="Báo cáo chỉ đọc từ Firebase Crashlytics. Số liệu thiếu được giữ là chưa biết."
        action={<Refresh onClick={state.refresh} busy={state.loading} />}
      />
      <div className="page-toolbar">
        <div className="tabs">
          <Button
            className={days === "7" ? "active" : ""}
            onClick={() => setDays("7")}
          >
            7 ngày
          </Button>
          <Button
            className={days === "30" ? "active" : ""}
            onClick={() => setDays("30")}
          >
            30 ngày
          </Button>
        </div>
        <Button className="button secondary" asChild>
          <a href={consoleUrl} target="_blank" rel="noopener noreferrer">
            Firebase Console
            <ArrowSquareOut size={18} />
          </a>
        </Button>
      </div>
      {state.error && <ErrorBox message={state.error} retry={state.refresh} />}
      {!data && state.loading ? (
        <Loading />
      ) : data && !data.configured ? (
        <Section
          title="Chưa kết nối quyền đọc báo cáo"
          detail="Crashlytics trên mobile và Firebase Console vẫn hoạt động riêng."
        >
          <Empty
            title="Backend chưa có quyền Crashlytics"
            detail={
              data.reason ?? "Cần cấu hình identity chỉ đọc, không bật billing."
            }
          />
          <div className="notice">
            <ShieldCheck size={24} />
            <p>
              Không mở quyền Firestore/Auth hoặc dùng dữ liệu mẫu để điền
              dashboard. Không trả user ID, nội dung lỗi riêng, custom logs hay
              ledger ra web.
            </p>
          </div>
        </Section>
      ) : (
        data && (
          <>
            <div className="notice">
              <ShieldCheck size={24} />
              <p>
                {data.source} ·{" "}
                {data.start ? `${time(data.start)} → ${time(data.end!)}` : ""}.
                Đọc lúc {time(data.checkedAt)}; cache tối đa60giây. Số user ảnh
                hưởng được hiển thị theo từng nhóm, không cộng trùng giữa issue.
              </p>
            </div>
            <div className="stats-grid">
              <article className="stat">
                <span>Nhóm trên trang</span>
                <strong>{rows.length}</strong>
                <small>Tối đa25 nhóm mỗi lượt</small>
              </article>
              <article className="stat">
                <span>Nhóm toàn báo cáo</span>
                <strong>{value(data.totalGroups)}</strong>
                <small>totalSize do Firebase cung cấp</small>
              </article>
              <article className="stat">
                <span>Sự kiện trên trang</span>
                <strong>{value(events)}</strong>
                <small>Không thay tổng toàn hệ thống</small>
              </article>
              <article className="stat">
                <span>Nguồn báo cáo</span>
                <strong style={{ fontSize: 22 }}>Firebase</strong>
                <small>Observed · không extrapolate</small>
              </article>
            </div>
            <Section
              title="Chi tiết báo cáo"
              detail="Chỉ số thực theo nhóm và khoảng thời gian đã chọn."
              action={<Badge tone="green">Chỉ đọc</Badge>}
            >
              {!!data.reports.length && (
                <label style={{ marginBottom: 20 }}>
                  Loại báo cáo
                  <NativeSelect
                    value={data.selected ?? ""}
                    onChange={(e) => setReport(e.target.value)}
                  >
                    {data.reports.map((r) => (
                      <NativeSelectOption key={r.id} value={r.id}>
                        {r.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
              {!rows.length ? (
                <Empty
                  title="Chưa có nhóm lỗi trong báo cáo"
                  detail="Sau khi test crash/handled trên mobile, mở lại app và chờ Firebase xử lý rồi làm mới. Không suy 100% crash-free khi chưa có mẫu."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhóm / loại</TableHead>
                      <TableHead>Sự kiện</TableHead>
                      <TableHead>User ảnh hưởng</TableHead>
                      <TableHead>Phiên ảnh hưởng</TableHead>
                      <TableHead>Gần nhất</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <strong>{r.title}</strong>
                          <small>{kinds[r.type] ?? r.type}</small>
                        </TableCell>
                        <TableCell>{value(r.events)}</TableCell>
                        <TableCell>{value(r.users)}</TableCell>
                        <TableCell>{value(r.sessions)}</TableCell>
                        <TableCell>
                          {r.lastSeen ? time(r.lastSeen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {data.hasMore && (
                <div className="notice">
                  <WarningCircle size={24} />
                  <p>
                    Còn nhóm ở các trang sau. Màn này hiển thị25 nhóm đầu; mở
                    Firebase Console để xem toàn bộ. Các tổng trên chỉ áp dụng
                    trang đang tải.
                  </p>
                </div>
              )}
            </Section>
          </>
        )
      )}
    </>
  );
}
