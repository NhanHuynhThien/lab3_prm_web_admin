import { useState } from "react";
import { ArrowSquareOut, WarningCircle } from "@phosphor-icons/react";
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
  type BadgeTone,
} from "../components/ui";
import { time } from "../types";
import { useAuth } from "../auth";
import { firebaseConsole } from "../lib/console";
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
const value = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("vi-VN").format(n);

/** Issue types from the Reports API; unknown types keep their raw name. */
const kinds: Record<string, { label: string; tone: BadgeTone }> = {
  FATAL: { label: "Crash", tone: "red" },
  NON_FATAL: { label: "Lỗi có xử lý", tone: "amber" },
  ANR: { label: "Không phản hồi", tone: "orange" },
  OTHER: { label: "Nhóm thống kê", tone: "neutral" },
};
const kind = (type: string) =>
  Object.hasOwn(kinds, type)
    ? kinds[type]
    : { label: type, tone: "neutral" as const };
const openExternal = (url: string) =>
  window.open(url, "_blank", "noopener,noreferrer");

export function Crashlytics() {
  const [days, setDays] = useState("7"),
    [report, setReport] = useState("");
  const query = new URLSearchParams({ days, ...(report ? { report } : {}) });
  const state = useResource<Data>(`/v1/admin/crashlytics?${query}`),
    data = state.data;
  const { session } = useAuth();
  const consoleUrl =
    data?.consoleUrl ??
    (session ? firebaseConsole(session.project, "crashlytics") : undefined);
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
        title="Báo cáo Crashlytics"
        description="Chỉ đọc từ Firebase. Số liệu thiếu được hiển thị là chưa biết."
        action={<Refresh onClick={state.refresh} busy={state.loading} />}
      />
      <div className="page-toolbar">
        <div className="tabs">
          <Button
            className={days === "7" ? "active" : ""}
            aria-pressed={days === "7"}
            onClick={() => setDays("7")}
          >
            7 ngày
          </Button>
          <Button
            className={days === "30" ? "active" : ""}
            aria-pressed={days === "30"}
            onClick={() => setDays("30")}
          >
            30 ngày
          </Button>
        </div>
        {consoleUrl && (
          <Button className="button secondary" asChild>
            <a href={consoleUrl} target="_blank" rel="noopener noreferrer">
              Firebase Console
              <ArrowSquareOut size={18} />
            </a>
          </Button>
        )}
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
        </Section>
      ) : (
        data && (
          <>
            <div className="stats-grid two">
              <article className="stat">
                <span>Nhóm lỗi</span>
                <strong>{rows.length}</strong>
                <small>
                  {data.totalGroups === null
                    ? "Firebase chưa trả tổng số nhóm"
                    : `Trên tổng ${value(data.totalGroups)} nhóm của báo cáo`}
                </small>
              </article>
              <article className="stat">
                <span>Sự kiện</span>
                <strong>{value(events)}</strong>
                <small>Tính trên các nhóm đang hiển thị</small>
              </article>
            </div>
            <Section
              title="Chi tiết báo cáo"
              detail="Chỉ số thực theo nhóm và khoảng thời gian đã chọn."
            >
              {!!data.reports.length && (
                <label className="field-gap">
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
                <Table className="stack-table">
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
                    {rows.map((r) => {
                      const k = kind(r.type);
                      return (
                        <TableRow
                          key={r.id}
                          className="clickable-row"
                          onClick={(e) => {
                            // The title link handles its own clicks and keys.
                            if (!(e.target as Element).closest("a"))
                              openExternal(r.url);
                          }}
                        >
                          <TableCell className="cell-title">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {r.title}
                            </a>
                            <Badge tone={k.tone}>{k.label}</Badge>
                          </TableCell>
                          <TableCell data-label="Sự kiện">
                            {value(r.events)}
                          </TableCell>
                          <TableCell data-label="User ảnh hưởng">
                            {value(r.users)}
                          </TableCell>
                          <TableCell data-label="Phiên ảnh hưởng">
                            {value(r.sessions)}
                          </TableCell>
                          <TableCell data-label="Gần nhất">
                            {r.lastSeen ? time(r.lastSeen) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {data.hasMore && (
                <div className="notice">
                  <WarningCircle size={24} />
                  <p>
                    Chỉ hiển thị trang đầu; các tổng chỉ tính trên trang này.
                  </p>
                </div>
              )}
            </Section>
            <p className="table-meta">
              {[
                data.source,
                data.start && data.end
                  ? `${time(data.start)} → ${time(data.end)}`
                  : null,
                `Đọc lúc ${time(data.checkedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        )
      )}
    </>
  );
}
