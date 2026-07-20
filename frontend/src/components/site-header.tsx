"use client";

import { ClipboardList, Home, LogOut, Recycle, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const items = [
    { href: "/", label: "홈", icon: Home },
    { href: "/activity", label: "내 활동", icon: ClipboardList },
    { href: "/mileage", label: "마일리지", icon: WalletCards },
  ];
  if (user?.role === "ADMIN") {
    items.push({ href: "/admin", label: "관리자", icon: ShieldCheck });
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/">
          <span className="site-brand-mark"><Recycle size={21} /></span>
          <span>
            <strong>HUFS Recycle</strong>
            <small>글로벌캠퍼스</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="주요 메뉴">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="header-account">
          {user ? (
            <>
              <span className="header-points">{user.mileage_balance}P</span>
              <button className="icon-button" type="button" onClick={signOut} title="로그아웃">
                <LogOut size={19} />
              </button>
            </>
          ) : (
            <span className="header-login-state">로그인 전</span>
          )}
        </div>
      </div>
    </header>
  );
}
