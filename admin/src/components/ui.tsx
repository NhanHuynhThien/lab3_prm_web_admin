import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  WarningCircle,
  SpinnerGap,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
export function Brand() {
  return (
    <div className="brand">
      <img src="/tokenledger.svg" alt="" />
      <span>
        TokenLedger<small>ADMIN WORKSPACE</small>
      </span>
    </div>
  );
}
export type BadgeTone = "green" | "amber" | "orange" | "red" | "neutral";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <ShadcnBadge variant="outline" className={`badge ${tone}`}>
      {children}
    </ShadcnBadge>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="error-box">
      <WarningCircle size={22} />
      <AlertTitle>Chưa hoàn tất thao tác</AlertTitle>
      <AlertDescription>
        {message}
        {retry && (
          <Button variant="link" onClick={retry}>
            <ArrowClockwise />
            Thử lại
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CheckCircle size={30} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <SpinnerGap className="spin" size={24} />
      Đang tải dữ liệu…
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Section({
  title,
  detail,
  children,
  action,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="panel">
      <CardHeader className="section-heading">
        <div>
          <CardTitle>{title}</CardTitle>
          {detail && <CardDescription>{detail}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(() => {
    const n = ++generation.current;
    setLoading(true);
    setError("");
    void api<T>(path)
      .then((d) => {
        if (n === generation.current) setData(d);
      })
      .catch((e) => {
        if (n === generation.current) setError(e.message);
      })
      .finally(() => {
        if (n === generation.current) setLoading(false);
      });
  }, [path]);
  useEffect(() => {
    refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
export function Refresh({
  onClick,
  busy = false,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <Button
      className="button secondary refresh-button"
      onClick={onClick}
      disabled={busy}
      aria-label="Làm mới"
    >
      <ArrowClockwise className={busy ? "spin" : ""} size={19} />
      <span className="refresh-label">Làm mới</span>
    </Button>
  );
}
export function InlineLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button className="text-button" onClick={onClick}>
      {children}
      <ArrowRight size={18} />
    </Button>
  );
}
