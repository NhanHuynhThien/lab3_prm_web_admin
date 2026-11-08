"use client";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SquaresFour,
  SignOut,
  ArrowSquareOut,
  Bug,
  type Icon,
} from "@phosphor-icons/react";
import { useAuth } from "./auth";
import { logout } from "./firebase";
import { Brand } from "./components/ui";
import { Login } from "./views/Login";
import { firebaseConsole } from "./lib/console";
import { sectionPath, sections, type Section } from "./sections";
// Views load on demand so the login screen ships without them.
const Overview = dynamic(() =>
  import("./views/Overview").then((m) => m.Overview),
);
const Crashlytics = dynamic(() =>
  import("./views/Crashlytics").then((m) => m.Crashlytics),
);
// Keyed by section so adding a page without a nav entry fails type checking.
const navItems: Record<Section, { name: string; icon: Icon }> = {
  overview: { name: "Tổng quan", icon: SquaresFour },
  crashlytics: { name: "Crashlytics", icon: Bug },
};
const nav = sections.map((id) => ({ id, ...navItems[id] }));
export default function App() {
  const { user, session, loading } = useAuth();
  const pathname = usePathname(),
    router = useRouter();
  const value = pathname.split("/")[1];
  const page =
    nav.find((n) => n.id === value)?.id ?? ("overview" satisfies Section);
  function navigate(id: Section) {
    router.push(sectionPath(id));
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
        <nav aria-label="Điều hướng quản trị">{items}</nav>
        <a
          href={firebaseConsole(session.project)}
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
          ) : (
            <Crashlytics />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {items}
      </nav>
    </div>
  );
}
