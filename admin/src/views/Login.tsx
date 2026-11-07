import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  ArrowRight,
  Database,
  Key,
  LockSimple,
  SignOut,
} from "@phosphor-icons/react";
import { login, logout } from "../firebase";
import { useAuth } from "../auth";
import { Brand, ErrorBox, Loading } from "../components/ui";
export function Login() {
  const { user, session, error, refresh, loading } = useAuth();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [copied, setCopied] = useState("");
  async function copyUid(uid: string) {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied("Đã sao chép UID");
    } catch {
      setCopied("Chưa sao chép được, hãy chọn UID ở trên");
    }
  }
  async function signIn() {
    setBusy(true);
    setFailure("");
    try {
      await login();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setFailure(
        code === "auth/unauthorized-domain"
          ? "Hostname chưa được Firebase cho phép. Mở http://localhost:5173 để đăng nhập local."
          : code === "auth/popup-blocked"
            ? "Trình duyệt đang chặn popup Google. Cho phép popup rồi thử lại."
            : code === "auth/popup-closed-by-user"
              ? "Cửa sổ đăng nhập đã đóng. Bạn có thể mở lại để tiếp tục."
              : "Chưa đăng nhập được. Kiểm tra mạng rồi thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-intro">
          <div className="eyebrow">WEB QUẢN TRỊ · CHỈ DÀNH CHO ADMIN</div>
          <h1>
            Mọi công cụ.
            <br />
            Một hệ thống rõ ràng.
          </h1>
          <p>
            Theo dõi crash và trạng thái hệ thống. Người dùng xem token của mình
            trên app mobile TokenLedger.
          </p>
          <div className="story-points">
            <span>
              <Database />
              Nhật ký vận hành rõ ràng
            </span>
            <span>
              <Key />
              Quyền quản trị được xác minh
            </span>
          </div>
        </div>
        <p className="story-footer">TokenLedger · AI usage, understood.</p>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <span className="icon-tile">
            <LockSimple size={26} />
          </span>
          <h2>{user ? "Xác minh quyền quản trị" : "Chào mừng trở lại"}</h2>
          <p>
            {user
              ? "Đăng nhập Google đã hoàn tất. Backend kiểm tra quyền trước khi mở workspace."
              : "Đăng nhập bằng tài khoản Google đã được cấp quyền để mở không gian quản trị."}
          </p>
          {loading ? (
            <Loading />
          ) : user ? (
            <>
              <div className="account-box">
                <strong>{user.displayName || "Tài khoản Google"}</strong>
                <span>{user.email}</span>
              </div>
              {error ? (
                <ErrorBox message={error} retry={refresh} />
              ) : (
                <>
                  <div className="notice">
                    <LockSimple size={20} />
                    <p>
                      Tài khoản này chưa được cấp quyền admin. Dữ liệu cá nhân
                      trong app vẫn thuộc riêng bạn.
                    </p>
                  </div>
                  {session && (
                    <div className="uid-box">
                      <label>UID đã được backend xác minh</label>
                      <code>{session.uid}</code>
                      <Button
                        className="text-button"
                        onClick={() => void copyUid(session.uid)}
                      >
                        {copied || "Sao chép UID"}
                      </Button>
                    </div>
                  )}
                  <Button className="button secondary full" onClick={refresh}>
                    Kiểm tra lại quyền
                    <ArrowRight />
                  </Button>
                </>
              )}
              <Button className="text-button" onClick={() => void logout()}>
                <SignOut />
                Đăng xuất
              </Button>
            </>
          ) : (
            <>
              {(failure || error) && <ErrorBox message={failure || error} />}
              <Button
                className="button google full"
                disabled={busy}
                onClick={() => void signIn()}
              >
                <img src="/google-g.png" alt="" />
                {busy ? "Đang mở Google…" : "Đăng nhập bằng Google"}
                <ArrowRight />
              </Button>
            </>
          )}
          <div className="login-footnote">
            <LockSimple size={16} />
            Chỉ dành cho tài khoản được cấp quyền. Admin không truy cập chat
            hoặc lịch sử token riêng của user.
          </div>
        </div>
      </section>
    </main>
  );
}
