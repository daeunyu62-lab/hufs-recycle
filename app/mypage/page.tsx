"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  BetaData,
  EMPTY_BETA_DATA,
  clearBetaData,
  formatRecordDate,
  loadBetaData,
} from "@/lib/storage";
import { buildBetaCheckInPath } from "@/lib/spots";

const CHECK_IN_URL = buildBetaCheckInPath();
const showBetaTools =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_BETA_TOOLS === "true";

export default function MyPage() {
  const [data, setData] = useState<BetaData>(EMPTY_BETA_DATA);
  const [loaded, setLoaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      setData(loadBetaData());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(initializeTimer);
  }, []);

  const resetData = () => {
    clearBetaData();
    setData(EMPTY_BETA_DATA);
    setConfirmReset(false);
  };

  return (
    <main className="dashboard-page">
      <AppHeader compact />
      <div className="dashboard-shell page-width">
        {!loaded ? (
          <section className="flow-card centered-card" role="status">
            <div className="spinner" />
            <h1>마이페이지를 불러오고 있습니다</h1>
          </section>
        ) : !data.user ? (
          <section className="flow-card centered-card empty-profile">
            <div className="status-symbol status-neutral" aria-hidden="true">H</div>
            <span className="card-kicker">MY ECO MILE</span>
            <h1>아직 본인확인 정보가 없습니다</h1>
            <p>QR 체크인을 시작하면 적립 결과를 이곳에서 확인할 수 있어요.</p>
            <a className="button button-primary button-full" href={CHECK_IN_URL}>데모 체크인 시작</a>
          </section>
        ) : (
          <>
            <section className="profile-hero">
              <div>
                <span className="eyebrow eyebrow-light">MY ECO MILE</span>
                <h1>HUFS 학생님의<br />친환경 실천 기록</h1>
                <p>{data.user.email}</p>
              </div>
              <div className="profile-mark" aria-hidden="true">♻</div>
            </section>

            <section className="stats-grid" aria-label="마일리지 요약">
              <article className="stat-card stat-primary">
                <span>현재 보유 마일리지</span>
                <strong>{data.points.toLocaleString("ko-KR")}<small>M</small></strong>
                <p>한 번의 실천이 캠퍼스를 바꿔요.</p>
              </article>
              <article className="stat-card">
                <span>누적 인증 횟수</span>
                <strong>{data.records.length}<small>회</small></strong>
                <p>분리배출 인증 완료</p>
              </article>
            </section>

            <section className="history-section">
              <div className="history-heading">
                <div>
                  <span className="card-kicker">MILEAGE HISTORY</span>
                  <h2>최근 적립 내역</h2>
                </div>
                <a className="text-link" href={CHECK_IN_URL}>새 체크인</a>
              </div>
              {data.records.length === 0 ? (
                <div className="empty-history">
                  <span aria-hidden="true">＋</span>
                  <strong>아직 적립 내역이 없습니다</strong>
                  <p>첫 분리배출을 인증하고 100 마일리지를 받아보세요.</p>
                </div>
              ) : (
                <ol className="history-list">
                  {data.records.map((record) => (
                    <li key={record.id}>
                      <div className="history-icon" aria-hidden="true">✓</div>
                      <div className="history-copy">
                        <strong>{record.spotName}</strong>
                        <time dateTime={record.createdAt}>{formatRecordDate(record.createdAt)}</time>
                      </div>
                      <b>+{record.points} M</b>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {showBetaTools && (
              <section className="beta-tools">
                <div>
                  <span>개발·발표 전용</span>
                  <strong>베타 데이터 관리</strong>
                  <p>반복 시연을 위해 로그인과 적립 내역을 초기화할 수 있습니다.</p>
                </div>
                {confirmReset ? (
                  <div className="reset-confirm" role="alert">
                    <span>정말 모든 베타 데이터를 지울까요?</span>
                    <button className="button button-danger" data-testid="confirm-reset" onClick={resetData}>초기화</button>
                    <button className="button button-secondary" onClick={() => setConfirmReset(false)}>취소</button>
                  </div>
                ) : (
                  <button className="button button-secondary" data-testid="reset-beta-data" onClick={() => setConfirmReset(true)}>베타 데이터 초기화</button>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
