"use client";

import { ClipboardList, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  apiRequest,
  formatDate,
  SubmissionList,
  SubmissionStatus,
} from "@/lib/api";
import { userFacingError } from "@/lib/error-messages";

const filters: Array<{ label: string; value: "ALL" | SubmissionStatus }> = [
  { label: "전체", value: "ALL" },
  { label: "검토 대기", value: "PENDING" },
  { label: "승인", value: "APPROVED" },
  { label: "거절", value: "REJECTED" },
];

export function ActivityPage() {
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState<SubmissionList | null>(null);
  const [filter, setFilter] = useState<"ALL" | SubmissionStatus>("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void apiRequest<SubmissionList>("/users/me/submissions?page=1&page_size=100", {
      token,
    })
      .then(setData)
      .catch((fetchError) =>
        setError(userFacingError(fetchError, "인증 내역을 불러오지 못했습니다.")),
      );
  }, [token]);

  const items = useMemo(
    () => data?.items.filter((item) => filter === "ALL" || item.status === filter) ?? [],
    [data, filter],
  );

  if (isLoading) return <main className="page-shell"><div className="loading-panel">내역 확인 중</div></main>;
  if (!user) {
    return <main className="page-shell"><section className="surface narrow-surface"><h1>내 활동</h1><AccountForm /></section></main>;
  }

  return (
    <main className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">SUBMISSIONS</p><h1>내 인증 내역</h1><p>제출한 사진 인증의 검토 상태를 확인합니다.</p></div></div>
      <div className="segmented-control" role="group" aria-label="인증 상태 필터">
        {filters.map((item) => (
          <button className={filter === item.value ? "active" : ""} key={item.value} type="button" onClick={() => setFilter(item.value)}>{item.label}</button>
        ))}
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <section className="surface">
        {items.length ? (
          <div className="submission-list">
            {items.map((item) => (
              <article className="submission-row" key={item.id}>
                <div className="submission-icon"><ClipboardList size={20} /></div>
                <div className="submission-main">
                  <div className="submission-title-row"><strong>{item.location_name}</strong><StatusBadge status={item.status} /></div>
                  <span className="muted-line"><MapPin size={14} /> {item.location_code} · 거리 {item.distance_m.toFixed(1)}m</span>
                  <span className="muted-line">{formatDate(item.submitted_at)}</span>
                  {item.rejection_reason ? <div className="rejection-note">{item.rejection_reason}</div> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state">해당 상태의 인증 내역이 없습니다.</div>}
      </section>
    </main>
  );
}
