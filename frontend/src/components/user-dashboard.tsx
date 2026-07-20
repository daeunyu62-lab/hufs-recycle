"use client";

import {
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  QrCode,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  apiRequest,
  Eligibility,
  formatDate,
  SubmissionList,
} from "@/lib/api";
import { userFacingError } from "@/lib/error-messages";

export function UserDashboard() {
  const { user, token, isLoading } = useAuth();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    void Promise.all([
      apiRequest<Eligibility>("/submissions/eligibility", { token }),
      apiRequest<SubmissionList>("/users/me/submissions?page=1&page_size=5", {
        token,
      }),
    ])
      .then(([eligibilityData, submissionData]) => {
        setError("");
        setEligibility(eligibilityData);
        setSubmissions(submissionData);
      })
      .catch((fetchError) =>
        setError(userFacingError(fetchError, "사용자 현황을 불러오지 못했습니다.")),
      );
  }, [token]);

  if (isLoading) {
    return <main className="page-shell"><div className="loading-panel">로그인 상태 확인 중</div></main>;
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="page-heading">
          <div>
            <p className="eyebrow">HUFS GLOBAL CAMPUS</p>
            <h1>분리배출 인증</h1>
            <p>외대 계정으로 시작하고 쓰레기통 QR에서 촬영 인증을 진행합니다.</p>
          </div>
        </div>
        <div className="two-column-layout login-layout">
          <section className="surface account-surface">
            <div className="surface-heading">
              <div>
                <span className="section-kicker">ACCOUNT</span>
                <h2>외대 계정으로 시작</h2>
              </div>
            </div>
            <AccountForm />
          </section>
          <section className="flow-board" aria-label="인증 진행 순서">
            {[
              { icon: QrCode, title: "QR 스캔", text: "지정 쓰레기통 확인" },
              { icon: MapPin, title: "위치 확인", text: "거리와 GPS 검증" },
              { icon: Camera, title: "사진 촬영", text: "후면 카메라 사용" },
              { icon: CheckCircle2, title: "인증 완료", text: "검토 후 승인" },
              { icon: WalletCards, title: "마일리지", text: "승인 시 1점 적립" },
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <div className="flow-row" key={step.title}>
                  <span className="flow-index">{index + 1}</span>
                  <Icon size={20} />
                  <div><strong>{step.title}</strong><span>{step.text}</span></div>
                </div>
              );
            })}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">MY RECYCLE</p>
          <h1>{user.student_number}님의 현황</h1>
          <p>{user.email}</p>
        </div>
        <span className="role-label">{user.role === "ADMIN" ? "관리자" : "학생"}</span>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="metric-strip">
        <div className="summary-metric accent-green">
          <WalletCards size={21} />
          <span>현재 마일리지</span>
          <strong>{user.mileage_balance}P</strong>
        </div>
        <div className="summary-metric accent-blue">
          <CheckCircle2 size={21} />
          <span>오늘 남은 인증</span>
          <strong>{eligibility?.remaining_today ?? "-"}회</strong>
        </div>
        <div className="summary-metric accent-amber">
          <Clock3 size={21} />
          <span>다음 인증 가능</span>
          <strong className="metric-copy">
            {eligibility?.can_submit_now
              ? "지금 가능"
              : formatDate(eligibility?.next_submission_at ?? null)}
          </strong>
        </div>
      </section>

      <section className="surface">
        <div className="surface-heading">
          <div>
            <span className="section-kicker">RECENT</span>
            <h2>최근 인증</h2>
          </div>
          <Link className="text-link" href="/activity">전체 보기</Link>
        </div>
        {submissions?.items.length ? (
          <div className="data-list">
            {submissions.items.map((submission) => (
              <div className="data-row" key={submission.id}>
                <div>
                  <strong>{submission.location_name}</strong>
                  <span>{formatDate(submission.submitted_at)}</span>
                </div>
                <StatusBadge status={submission.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">아직 제출한 분리배출 인증이 없습니다.</div>
        )}
      </section>
    </main>
  );
}
