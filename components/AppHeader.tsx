type AppHeaderProps = {
  compact?: boolean;
};

export function AppHeader({ compact = false }: AppHeaderProps) {
  return (
    <header className={`app-header ${compact ? "app-header-compact" : ""}`}>
      <div className="header-inner page-width">
        <Link className="brand" href="/" aria-label="HUFS ECO MILE 홈">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          <span className="brand-text">
            <strong>HUFS ECO MILE</strong>
            <small>GLOBAL CAMPUS</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="주요 메뉴">
          <a href="/beta-qr">베타 QR</a>
          <a href="/mypage">마이페이지</a>
        </nav>
      </div>
    </header>
  );
}
import Link from "next/link";
