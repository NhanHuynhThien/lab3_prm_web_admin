import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { Model, Price, NotificationDraft } from "./schemas.js";
import { HttpError } from "./errors.js";
type Row = Record<string, any>;
export class Store {
  readonly db: SupabaseClient;
  constructor(
    url: string,
    key: string,
    private encryptionKey: string,
  ) {
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(12000) }),
      },
    });
  }
  private unwrap<T>(value: { data: T | null; error: any }): T {
    if (value.error) {
      const e = value.error;
      if (e.code === "23505" || e.message === "conflict")
        throw new HttpError(
          409,
          "Dữ liệu đã thay đổi hoặc phiên bản đã tồn tại. Hãy tải lại.",
        );
      if (e.message === "not_found")
        throw new HttpError(404, "Không tìm thấy model.");
      if (e.message === "daily_limit")
        throw new HttpError(429, "Đã đạt giới hạn phân tích trong ngày.");
      throw new HttpError(
        503,
        "Chưa truy cập được database. Hãy kiểm tra kết nối và schema.",
      );
    }
    return value.data as T;
  }
  async rows(table: "models" | "prices" | "audit" | "jobs"): Promise<Row[]> {
    const order = table === "models" ? "updated_at" : "created_at";
    const rows = this.unwrap(
      await this.db
        .from(`tl_${table}`)
        .select("payload")
        .order(order, { ascending: false })
        .limit(500),
    );
    return rows.map((r: any) => r.payload);
  }
  async models(): Promise<Model[]> {
    return (await this.rows("models")) as Model[];
  }
  async prices(): Promise<Price[]> {
    return (await this.rows("prices")) as Price[];
  }
  async audit(
    actor: string,
    action: string,
    target: string,
    outcome = "success",
  ) {
    const id = randomUUID();
    this.unwrap(
      await this.db
        .from("tl_audit")
        .insert({
          id,
          payload: {
            id,
            actor,
            action,
            target,
            outcome,
            at: new Date().toISOString(),
          },
        })
        .select("id"),
    );
  }
  async saveModel(
    value: Omit<Model, "updatedAt">,
    actor: string,
  ): Promise<Model> {
    return this.unwrap(
      await this.db.rpc("tl_save_model", { p_data: value, p_actor: actor }),
    );
  }
  async savePrice(
    value: Omit<Price, "id" | "createdAt" | "createdBy">,
    actor: string,
  ): Promise<Price> {
    return this.unwrap(
      await this.db.rpc("tl_save_price", { p_data: value, p_actor: actor }),
    );
  }
  private encrypt(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(this.encryptionKey, "hex"),
      iv,
    );
    const value = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), value]).toString("base64");
  }
  private decrypt(token: string) {
    const raw = Buffer.from(token, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.encryptionKey, "hex"),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  }
  async saveDevice(
    uid: string,
    id: string,
    token: string,
    hash: string,
    metadata: object,
  ) {
    this.unwrap(
      await this.db.rpc("tl_save_device", {
        p_uid: uid,
        p_id: id,
        p_token: this.encrypt(token),
        p_hash: hash,
        p_metadata: metadata,
      }),
    );
  }
  async removeDevice(uid: string, id: string) {
    this.unwrap(
      await this.db
        .from("tl_devices")
        .delete()
        .eq("uid", uid)
        .eq("id", id)
        .select("id"),
    );
  }
  async devices(
    uid?: string,
  ): Promise<{ uid: string; id: string; token: string }[]> {
    let query = this.db.from("tl_devices").select("uid,id,token").limit(501);
    if (uid) query = query.eq("uid", uid);
    return this.unwrap(await query).map((r: any) => ({
      ...r,
      token: this.decrypt(r.token),
    }));
  }
  async claimJob(
    draft: NotificationDraft,
    actor: string,
  ): Promise<{ existing: boolean; job: Row }> {
    return this.unwrap(
      await this.db.rpc("tl_claim_job", { p_draft: draft, p_actor: actor }),
    );
  }
  async finishJob(job: Row, recipients: string[]) {
    this.unwrap(
      await this.db.rpc("tl_finish_job", {
        p_job: job,
        p_recipients: [...new Set(recipients)],
      }),
    );
  }
  async inbox(uid: string): Promise<Row[]> {
    return this.unwrap(
      await this.db
        .from("tl_inbox")
        .select("payload")
        .eq("uid", uid)
        .order("created_at", { ascending: false })
        .limit(100),
    ).map((r: any) => r.payload);
  }
  async readInbox(uid: string, id: string) {
    const old = (await this.inbox(uid)).find((n) => n.id === id);
    if (!old) throw new HttpError(404, "Không có thông báo.");
    this.unwrap(
      await this.db
        .from("tl_inbox")
        .update({ payload: { ...old, readAt: new Date().toISOString() } })
        .eq("uid", uid)
        .eq("id", id)
        .select("id"),
    );
  }
  async reserveAnalysis(uid: string, max: number): Promise<string> {
    return this.unwrap(
      await this.db.rpc("tl_reserve_analysis", { p_uid: uid, p_max: max }),
    );
  }
  async finishAnalysis(id: string, uid: string, result: object) {
    this.unwrap(
      await this.db
        .from("tl_analyses")
        .update({ payload: { id, ...result } })
        .eq("id", id)
        .eq("uid", uid)
        .select("id"),
    );
  }
  async analyses(uid: string): Promise<Row[]> {
    return this.unwrap(
      await this.db
        .from("tl_analyses")
        .select("payload")
        .eq("uid", uid)
        .order("created_at", { ascending: false })
        .limit(30),
    ).map((r: any) => r.payload);
  }
  async summary() {
    const tables = ["models", "prices", "devices", "jobs", "audit"];
    const counts = await Promise.all(
      tables.map(async (t) => {
        const r = await this.db
          .from(`tl_${t}`)
          .select("id", { count: "exact", head: true });
        this.unwrap(r);
        return r.count ?? 0;
      }),
    );
    return {
      models: counts[0],
      prices: counts[1],
      devices: counts[2],
      jobs: counts[3],
      auditEvents: counts[4],
    };
  }
  close() {}
}
