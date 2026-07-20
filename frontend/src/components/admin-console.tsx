"use client";

import {
  Check,
  Download,
  ImageIcon,
  MapPinned,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/status-badge";
import {
  AdminLocation,
  AdminStatistics,
  AdminSubmission,
  AdminSubmissionList,
  apiRequest,
  API_BASE_URL,
  formatDate,
  resolveAssetUrl,
  SubmissionStatus,
} from "@/lib/api";
import { userFacingError } from "@/lib/error-messages";

type AdminTab = "submissions" | "locations";

const emptyLocationForm = {
  name: "",
  description: "",
  latitude: "37.337739",
  longitude: "127.268589",
  allowedRadius: "30",
};

export function AdminConsole() {
  const { user, token, isLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>("submissions");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SubmissionStatus>("PENDING");
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionList | null>(null);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [selected, setSelected] = useState<AdminSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const [statsData, submissionsData, locationsData] = await Promise.all([
        apiRequest<AdminStatistics>("/admin/statistics", { token }),
        apiRequest<AdminSubmissionList>(`/admin/submissions${query}`, { token }),
        apiRequest<{ items: AdminLocation[]; total: number }>("/admin/locations", {
          token,
        }),
      ]);
      setError("");
      setStatistics(statsData);
      setSubmissions(submissionsData);
      setLocations(locationsData.items);
    } catch (loadError) {
      setError(userFacingError(loadError, "관리자 데이터를 불러오지 못했습니다."));
    }
  }, [statusFilter, token, user?.role]);

  useEffect(() => {
    queueMicrotask(() => void loadDashboard());
  }, [loadDashboard]);

  const selectedImageUrl = useMemo(
    () => resolveAssetUrl(selected?.image_url),
    [selected?.image_url],
  );

  async function openSubmission(submissionId: number) {
    setError("");
    try {
      setSelected(
        await apiRequest<AdminSubmission>(`/admin/submissions/${submissionId}`, {
          token,
        }),
      );
      setRejectReason("");
    } catch (detailError) {
      setError(userFacingError(detailError, "인증 상세를 불러오지 못했습니다."));
    }
  }

  async function reviewSubmission(action: "approve" | "reject") {
    if (!selected) return;
    if (action === "reject" && !rejectReason.trim()) {
      setError("거절 사유를 입력해 주세요.");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      await apiRequest(`/admin/submissions/${selected.id}/${action}`, {
        method: "PATCH",
        token,
        body: action === "reject" ? JSON.stringify({ reason: rejectReason }) : undefined,
      });
      setNotice(action === "approve" ? "인증을 승인하고 마일리지를 적립했습니다." : "인증을 거절했습니다.");
      setSelected(null);
      await loadDashboard();
    } catch (reviewError) {
      setError(userFacingError(reviewError, "검토 결과를 저장하지 못했습니다."));
    } finally {
      setIsBusy(false);
    }
  }

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError("");
    try {
      await apiRequest("/admin/locations", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: locationForm.name,
          description: locationForm.description || null,
          latitude: Number(locationForm.latitude),
          longitude: Number(locationForm.longitude),
          allowed_radius_m: Number(locationForm.allowedRadius),
          is_active: true,
        }),
      });
      setLocationForm(emptyLocationForm);
      setNotice("새 쓰레기통을 등록했습니다.");
      await loadDashboard();
    } catch (createError) {
      setError(userFacingError(createError, "쓰레기통을 등록하지 못했습니다."));
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleLocation(location: AdminLocation) {
    setIsBusy(true);
    setError("");
    try {
      await apiRequest(`/admin/locations/${location.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ is_active: !location.is_active }),
      });
      await loadDashboard();
    } catch (toggleError) {
      setError(userFacingError(toggleError, "쓰레기통 상태를 변경하지 못했습니다."));
    } finally {
      setIsBusy(false);
    }
  }

  async function downloadQr(location: AdminLocation) {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/locations/${location.id}/qr-code`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("QR 이미지를 생성하지 못했습니다.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${location.code}-qr.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(userFacingError(downloadError, "QR 이미지를 내려받지 못했습니다."));
    }
  }

  if (isLoading) return <main className="page-shell"><div className="loading-panel">관리자 권한 확인 중</div></main>;
  if (!user) {
    return <main className="page-shell"><section className="surface narrow-surface"><h1>관리자 로그인</h1><AccountForm /></section></main>;
  }
  if (user.role !== "ADMIN") {
    return <main className="page-shell"><div className="blocking-state"><ShieldAlert size={34} /><h1>관리자 권한이 필요합니다</h1><p>현재 계정으로는 관리자 화면에 접근할 수 없습니다.</p></div></main>;
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-heading dashboard-heading">
        <div><p className="eyebrow">ADMIN CONSOLE</p><h1>분리배출 운영 관리</h1><p>제출 검토와 쓰레기통 QR을 관리합니다.</p></div>
        <button className="icon-button bordered" type="button" onClick={() => void loadDashboard()} title="새로고침"><RefreshCw size={19} /></button>
      </div>

      <section className="admin-metrics">
        <div><span>오늘 제출</span><strong>{statistics?.today_submissions ?? 0}</strong></div>
        <div><span>검토 대기</span><strong>{statistics?.pending_submissions ?? 0}</strong></div>
        <div><span>승인 완료</span><strong>{statistics?.approved_submissions ?? 0}</strong></div>
        <div><span>누적 적립</span><strong>{statistics?.total_points_awarded ?? 0}P</strong></div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice info">{notice}</div> : null}

      <div className="admin-tabs" role="tablist">
        <button className={tab === "submissions" ? "active" : ""} type="button" onClick={() => setTab("submissions")}>인증 검토</button>
        <button className={tab === "locations" ? "active" : ""} type="button" onClick={() => setTab("locations")}>쓰레기통·QR</button>
      </div>

      {tab === "submissions" ? (
        <div className="admin-workspace">
          <section className="surface admin-list-panel">
            <div className="surface-heading">
              <div><span className="section-kicker">REVIEW QUEUE</span><h2>인증 제출</h2></div>
              <select className="select-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | SubmissionStatus)}>
                <option value="PENDING">검토 대기</option><option value="APPROVED">승인</option><option value="REJECTED">거절</option><option value="ALL">전체</option>
              </select>
            </div>
            {submissions?.items.length ? (
              <div className="admin-submission-list">
                {submissions.items.map((item) => (
                  <button className={selected?.id === item.id ? "selected" : ""} key={item.id} type="button" onClick={() => void openSubmission(item.id)}>
                    <div><strong>{item.user_name}</strong><span>{item.user_student_number} · {item.location_name}</span><small>{formatDate(item.submitted_at)}</small></div>
                    <StatusBadge status={item.status} />
                  </button>
                ))}
              </div>
            ) : <div className="empty-state">해당 상태의 제출이 없습니다.</div>}
          </section>

          <section className="surface review-panel">
            {selected ? (
              <>
                <div className="surface-heading"><div><span className="section-kicker">SUBMISSION #{selected.id}</span><h2>{selected.user_name}의 인증</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} title="닫기"><X size={19} /></button></div>
                <div className="review-photo">
                  {selectedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedImageUrl} alt="분리배출 인증 사진" />
                  ) : <div><ImageIcon size={30} /><span>사진을 불러올 수 없습니다.</span></div>}
                </div>
                <dl className="detail-grid">
                  <div><dt>이메일</dt><dd>{selected.user_email}</dd></div>
                  <div><dt>학번</dt><dd>{selected.user_student_number}</dd></div>
                  <div><dt>쓰레기통</dt><dd>{selected.location_name}</dd></div>
                  <div><dt>거리 / GPS</dt><dd>{selected.distance_m.toFixed(1)}m / {selected.accuracy_m.toFixed(1)}m</dd></div>
                  <div><dt>제출 시각</dt><dd>{formatDate(selected.submitted_at)}</dd></div>
                  <div><dt>상태</dt><dd><StatusBadge status={selected.status} /></dd></div>
                </dl>
                {selected.status === "PENDING" ? (
                  <div className="review-actions">
                    <button className="action-button success" type="button" onClick={() => void reviewSubmission("approve")} disabled={isBusy}><Check size={18} />승인·1점 적립</button>
                    <label className="field"><span className="field-label">거절 사유</span><textarea className="textarea-control" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="거절 사유를 입력하세요" /></label>
                    <button className="action-button danger" type="button" onClick={() => void reviewSubmission("reject")} disabled={isBusy}><Trash2 size={18} />거절</button>
                  </div>
                ) : selected.rejection_reason ? <div className="rejection-note">{selected.rejection_reason}</div> : null}
              </>
            ) : <div className="empty-state tall"><ImageIcon size={30} />검토할 인증을 선택해 주세요.</div>}
          </section>
        </div>
      ) : (
        <div className="location-workspace">
          <section className="surface">
            <div className="surface-heading"><div><span className="section-kicker">LOCATIONS</span><h2>등록된 쓰레기통</h2></div><span className="total-count">{locations.length}개</span></div>
            <div className="location-list">
              {locations.map((location) => (
                <article className="location-row" key={location.id}>
                  <span className="location-symbol"><MapPinned size={20} /></span>
                  <div><strong>{location.name}</strong><span>{location.code} · 반경 {location.allowed_radius_m}m</span><small>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</small></div>
                  <div className="location-actions">
                    <button className="action-button secondary compact" type="button" onClick={() => void downloadQr(location)}><Download size={16} />QR</button>
                    <button className={`toggle-button ${location.is_active ? "on" : ""}`} type="button" onClick={() => void toggleLocation(location)} disabled={isBusy} aria-label={`${location.name} 활성화 상태 변경`}><span /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="surface create-location-panel">
            <div className="surface-heading"><div><span className="section-kicker">NEW LOCATION</span><h2>쓰레기통 등록</h2></div></div>
            <form className="location-form" onSubmit={createLocation}>
              <label className="field"><span className="field-label">이름</span><input className="text-input" value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} required /></label>
              <label className="field"><span className="field-label">설명</span><input className="text-input" value={locationForm.description} onChange={(event) => setLocationForm({ ...locationForm, description: event.target.value })} /></label>
              <div className="form-grid-2">
                <label className="field"><span className="field-label">위도</span><input className="text-input" type="number" step="0.000001" value={locationForm.latitude} onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })} required /></label>
                <label className="field"><span className="field-label">경도</span><input className="text-input" type="number" step="0.000001" value={locationForm.longitude} onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })} required /></label>
              </div>
              <label className="field"><span className="field-label">허용 반경(m)</span><input className="text-input" type="number" min="1" max="1000" value={locationForm.allowedRadius} onChange={(event) => setLocationForm({ ...locationForm, allowedRadius: event.target.value })} required /></label>
              <button className="action-button primary full" type="submit" disabled={isBusy}><Plus size={18} />쓰레기통 등록</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
