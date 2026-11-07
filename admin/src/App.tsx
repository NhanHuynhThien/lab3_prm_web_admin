"use client";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SquaresFour,
  SlidersHorizontal,
  SignOut,
  ArrowSquareOut,
  ShieldCheck,
  Bug,
} from "@phosphor-icons/react";
import { useAuth } from "./auth";
import { logout } from "./firebase";
import { Brand } from "./components/ui";
import { Login } from "./views/Login";
import type { Section } from "./sections";
// Views load on demand so the login screen ships without them.
const Overview = dynamic(() =>
  import("./views/Overview").then((m) => m.Overview),
);
const System = dynamic(() => import("./views/System").then((m) => m.System));
const Crashlytics = dynamic(() =>
  import("./views/Crashlytics").then((m) => m.Crashlytics),
);
const nav: { id: Section; name: string; icon: typeof Bug }[] = [
  { id: "overview", name: "Tổng quan", icon: SquaresFour },
  { id: "crashlytics", name: "Crashlytics", icon: Bug },
  { id: "system", name: "Hệ thống", icon: SlidersHorizontal },
];
export default function App() {
  const { user, session, loading } = useAuth();
  const pathname = usePathname(),
    router = useRouter();
  const value = pathname.split("/")[1];
  const page = nav.some((n) => n.id === value) ? value : "overview";
  function navigate(id: string) {
    router.push(id === "overview" ? "/" : `/${id}`);
  }
  if (loading || !user || !session?.admin) return <Login />;
  const items = nav.map((n) => (
    <Button
      className={page === n.id ? "nav-item active" : "nav-item"}
      key={n.id}
      onClick={() => navigate(n.id)}
      aria-current={page === n.id ? "page" : undefined}
    >
      <n.icon size={22} weight={page === n.id ? "fill" : "regular"} />
      {n.name}
    </Button>
  ));
  return (
    <div className="workspace">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="status-dot" />
          ADMIN · CHỈ DỮ LIỆU VẬN HÀNH
        </div>
        <nav aria-label="Điều hướng quản trị">{items}</nav>
        <div className="sidebar-note">
          <ShieldCheck size={24} />
          <strong>Web dành cho admin</strong>
          <p>Token và sổ cá nhân của user chỉ xem trên app mobile.</p>
        </div>
        <a
          href="https://console.firebase.google.com/project/tokenledger-nhan-20261021/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="console-link"
        >
          Firebase Console
          <ArrowSquareOut size={18} />
        </a>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <img className="topbar-logo" src="/tokenledger.svg" alt="" />
          <div className="breadcrumb">
            <span className="breadcrumb-root">Không gian quản trị</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{nav.find((n) => n.id === page)?.name}</strong>
          </div>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">
              {(user.displayName || user.email || "A").charAt(0)}
            </div>
            <div className="user-info">
              <strong>{user.displayName || "Quản trị viên"}</strong>
              <span>Quản trị vận hành</span>
            </div>
            <Button
              className="icon-button"
              aria-label="Đăng xuất"
              onClick={() => void logout()}
            >
              <SignOut size={21} />
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          className="main-content"
          key={`${session.uid}:${page}`}
        >
          {page === "overview" ? (
            <Overview navigate={navigate} />
          ) : page === "crashlytics" ? (
            <Crashlytics />
          ) : (
            <System />
          )}
          <footer className="page-footer">
            <span>TokenLedger Admin</span>
            <span>Dữ liệu thực · nguồn và trạng thái rõ ràng</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {items}
      </nav>
    </div>
  );
}
