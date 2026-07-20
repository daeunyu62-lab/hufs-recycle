"use client";

import { ArrowDownToLine, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { useAuth } from "@/components/auth-provider";
import { apiRequest, formatDate, PointBalance } from "@/lib/api";
import { userFacingError } from "@/lib/error-messages";

export function MileagePage() {
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState<PointBalance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void apiRequest<PointBalance>("/users/me/points?page=1&page_size=100", { token })
      .then(setData)
      .catch((fetchError) =>
        setError(userFacingError(fetchError, "마일리지 내역을 불러오지 못했습니다.")),
      );
  }, [token]);

  if (isLoading) return <main className="page-shell"><div className="loading-panel">마일리지 확인 중</div></main>;
  if (!user) {
    return <main className="page-shell"><section className="surface narrow-surface"><h1>마일리지</h1><AccountForm /></section></main>;
  }

  return (
    <main className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">MILEAGE</p><h1>마일리지</h1><p>승인된 분리배출 인증의 적립 내역입니다.</p></div></div>
      <section className="balance-band">
        <div><WalletCards size={26} /><span>현재 보유 마일리지</span></div>
        <strong>{data?.balance ?? user.mileage_balance}P</strong>
      </section>
      {error ? <div className="notice error">{error}</div> : null}
      <section className="surface">
        <div className="surface-heading"><div><span className="section-kicker">HISTORY</span><h2>적립 내역</h2></div><span className="total-count">총 {data?.total ?? 0}건</span></div>
        {data?.transactions.length ? (
          <div className="data-list">
            {data.transactions.map((transaction) => (
              <div className="point-row" key={transaction.id}>
                <span className="point-icon"><ArrowDownToLine size={18} /></span>
                <div><strong>{transaction.description}</strong><span>{formatDate(transaction.created_at)}</span></div>
                <strong className="point-amount">+{transaction.amount}P</strong>
              </div>
            ))}
          </div>
        ) : <div className="empty-state">아직 적립된 마일리지가 없습니다.</div>}
      </section>
    </main>
  );
}
