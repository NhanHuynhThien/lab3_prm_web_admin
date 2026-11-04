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
  Plus,
  MagnifyingGlass,
  PencilSimple,
  CurrencyDollar,
  ArrowLeft,
} from "@phosphor-icons/react";
import type { Catalog as CatalogData, Model } from "../types";
import { providers, modelStatuses, money, time } from "../types";
import { sendJson } from "../api";
import {
  useResource,
  PageHeading,
  Section,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Refresh,
} from "../components/ui";
const blank = {
  id: "",
  provider: "openai",
  name: "",
  status: "active",
  description: "",
  revision: 0,
};
export function Catalog() {
  const state = useResource<CatalogData>("/v1/catalog");
  const [tab, setTab] = useState("models"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<typeof blank | null>(null),
    [price, setPrice] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [success, setSuccess] = useState("");
  const models = state.data?.models ?? [],
    prices = state.data?.prices ?? [];
  function open(model?: Model) {
    setEditing(
      model
        ? {
            id: model.id,
            provider: model.provider,
            name: model.name,
            status: model.status,
            description: model.description,
            revision: model.revision,
          }
        : blank,
    );
    setPrice(false);
    setFailure("");
    setSuccess("");
  }
  async function saveModel(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFailure("");
    try {
      await sendJson("/v1/admin/models", editing);
      setEditing(null);
      setSuccess("Đã lưu model.");
      state.refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function savePrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    const form = new FormData(e.currentTarget);
    const usd = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      if (!/^\d+(\.\d{1,6})?$/.test(raw))
        throw new Error("Giá USD tối đa 6 chữ số thập phân.");
      const [whole, fraction = ""] = raw.split(".");
      const micros = Number(whole) * 1e6 + Number(fraction.padEnd(6, "0"));
      if (!Number.isSafeInteger(micros) || micros > 1e12)
        throw new Error("Giá vượt giới hạn hỗ trợ.");
      return micros;
    };
    try {
      await sendJson("/v1/admin/prices", {
        modelId: form.get("modelId"),
        inputMicros: usd("input"),
        outputMicros: usd("output"),
        cacheMicros: form.get("cache") ? usd("cache") : null,
        effectiveFrom: new Date(String(form.get("effective"))).toISOString(),
        sourceUrl: form.get("source"),
      });
      setPrice(false);
      setSuccess("Đã thêm phiên bản giá. Giá lịch sử được giữ nguyên.");
      state.refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / DANH MỤC"
        title="Model & bảng giá"
        description="Một nguồn tham khảo nhất quán, có phiên bản và ngày hiệu lực."
        action={
          <Button
            className="button primary"
            onClick={() =>
              tab === "models"
                ? open()
                : (setPrice(true), setEditing(null), setFailure(""))
            }
            disabled={busy || (tab === "prices" && !models.length)}
          >
            <Plus size={19} />
            {tab === "models" ? "Thêm model" : "Thêm phiên bản giá"}
          </Button>
        }
      />
      <div className="page-toolbar">
        <div className="tabs">
          <Button
            className={tab === "models" ? "active" : ""}
            onClick={() => {
              setTab("models");
              setPrice(false);
              setEditing(null);
            }}
          >
            Danh mục model <span>{models.length}</span>
          </Button>
          <Button
            className={tab === "prices" ? "active" : ""}
            onClick={() => {
              setTab("prices");
              setEditing(null);
            }}
          >
            Bảng giá <span>{prices.length}</span>
          </Button>
        </div>
        <Refresh onClick={state.refresh} busy={state.loading} />
      </div>
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      {failure && <ErrorBox message={failure} />}{" "}
      {state.error && <ErrorBox message={state.error} retry={state.refresh} />}
      {editing && (
        <Section
          title={editing.revision ? "Cập nhật model" : "Thêm model mới"}
          detail="Thông tin danh mục, không phải số liệu sử dụng cá nhân."
          action={
            <Button
              className="text-button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              <ArrowLeft />
              Đóng form
            </Button>
          }
        >
          <form onSubmit={saveModel} className="form-grid">
            <label>
              Mã model
              <Input
                required
                maxLength={128}
                pattern="[a-zA-Z0-9._:-]+"
                disabled={editing.revision > 0}
                value={editing.id}
                onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                placeholder="Ví dụ: model-id-chinh-thuc"
              />
            </label>
            <label>
              Tên hiển thị
              <Input
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Nhà cung cấp
              <NativeSelect
                value={editing.provider}
                onChange={(e) =>
                  setEditing({ ...editing, provider: e.target.value })
                }
              >
                {Object.entries(providers).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label>
              Trạng thái
              <NativeSelect
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                {Object.entries(modelStatuses).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="span-two">
              Mô tả
              <Textarea
                maxLength={400}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <div className="form-actions span-two">
              <Button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Hủy
              </Button>
              <Button className="button primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu model"}
              </Button>
            </div>
          </form>
        </Section>
      )}
      {price && (
        <Section
          title="Tạo phiên bản giá"
          detail="USD trên 1 triệu token. Chỉ nhập giá đã kiểm chứng; đây là giá tham khảo để ước tính."
        >
          <form onSubmit={savePrice} className="form-grid">
            <label>
              Model
              <NativeSelect name="modelId" required>
                {models.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label>
              Hiệu lực từ (giờ thiết bị)
              <Input
                name="effective"
                type="datetime-local"
                required
                defaultValue={new Date(
                  Date.now() - new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)}
              />
            </label>
            <label>
              Input · USD / 1M token
              <Input
                name="input"
                inputMode="decimal"
                required
                placeholder="0.000000"
              />
            </label>
            <label>
              Output · USD / 1M token
              <Input
                name="output"
                inputMode="decimal"
                required
                placeholder="0.000000"
              />
            </label>
            <label>
              Cache đọc · tùy chọn
              <Input
                name="cache"
                inputMode="decimal"
                placeholder="Trống nếu chưa có nguồn"
              />
            </label>
            <label>
              Link nguồn giá chính thức
              <Input
                name="source"
                type="url"
                required
                placeholder="https://…"
              />
            </label>
            <div className="form-actions span-two">
              <Button
                className="button secondary"
                type="button"
                onClick={() => setPrice(false)}
                disabled={busy}
              >
                Hủy
              </Button>
              <Button className="button primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Tạo phiên bản"}
              </Button>
            </div>
          </form>
        </Section>
      )}
      <Section
        title={tab === "models" ? "Danh mục model" : "Lịch sử bảng giá"}
        detail={
          tab === "models"
            ? "Cập nhật thông tin để ứng dụng sử dụng nhất quán."
            : "Giá có hiệu lực theo thời gian; không thay đổi chi phí đã ghi của user."
        }
        action={
          tab === "models" ? (
            <label className="search">
              <MagnifyingGlass size={19} />
              <Input
                aria-label="Tìm model"
                placeholder="Tìm model hoặc provider"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          ) : undefined
        }
      >
        {state.loading && !state.data ? (
          <Loading />
        ) : tab === "models" ? (
          !models.length ? (
            <Empty
              title="Danh mục đang trống"
              detail="Thêm model đầu tiên. Không có model mẫu được tạo tự động."
              action={
                <Button className="button primary" onClick={() => open()}>
                  <Plus />
                  Thêm model
                </Button>
              }
            />
          ) : (
            <div className="table-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead>
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models
                    .filter((m) =>
                      `${m.name} ${m.id} ${m.provider}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <strong>{m.name}</strong>
                          <small>{m.id}</small>
                        </TableCell>
                        <TableCell>{providers[m.provider]}</TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              m.status === "active"
                                ? "green"
                                : m.status === "paused"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {modelStatuses[m.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="nowrap">
                          {time(m.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            className="icon-button"
                            aria-label={`Sửa ${m.name}`}
                            onClick={() => open(m)}
                          >
                            <PencilSimple size={20} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : !prices.length ? (
          <Empty
            title="Chưa có phiên bản giá"
            detail={
              models.length
                ? "Thêm nguồn giá đã kiểm chứng cho model."
                : "Thêm model trước khi tạo bảng giá."
            }
            action={
              models.length ? (
                <Button
                  className="button primary"
                  onClick={() => setPrice(true)}
                >
                  <CurrencyDollar />
                  Thêm giá
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Input / 1M</TableHead>
                  <TableHead>Output / 1M</TableHead>
                  <TableHead>Cache / 1M</TableHead>
                  <TableHead>Hiệu lực</TableHead>
                  <TableHead>Nguồn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <strong>
                        {models.find((m) => m.id === p.modelId)?.name ??
                          p.modelId}
                      </strong>
                    </TableCell>
                    <TableCell>{money(p.inputMicros)}</TableCell>
                    <TableCell>{money(p.outputMicros)}</TableCell>
                    <TableCell>{money(p.cacheMicros)}</TableCell>
                    <TableCell className="nowrap">
                      {time(p.effectiveFrom)}
                    </TableCell>
                    <TableCell>
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem nguồn ↗
                      </a>
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
