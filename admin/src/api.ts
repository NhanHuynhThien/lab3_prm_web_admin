import { auth } from "./firebase";
export const base =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8788";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Bạn cần đăng nhập lại.");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "omit",
      signal: options.signal ?? AbortSignal.timeout(45000),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error(
      "Chưa kết nối được API. Kiểm tra backend đang chạy và thử lại.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Chưa hoàn tất yêu cầu.");
  return data;
}
export function sendJson<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
