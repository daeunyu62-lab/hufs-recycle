"use client";

import {
  Camera,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { useAuth } from "@/components/auth-provider";
import {
  apiRequest,
  Eligibility,
  formatDate,
  QrVerification,
  SubmissionCreateResult,
} from "@/lib/api";
import { userFacingError } from "@/lib/error-messages";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeMb = 5;

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function readQrQuery() {
  if (typeof window === "undefined") return { binId: "", token: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    binId: params.get("bin_id") ?? "",
    token: params.get("token") ?? params.get("qr_token") ?? "",
  };
}

export function SubmissionConsole() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [qr] = useState(readQrQuery);
  const { user, token, isLoading, refreshUser } = useAuth();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [verification, setVerification] = useState<QrVerification | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionCreateResult | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasQr = Boolean(qr.binId && qr.token);
  const canCapture = Boolean(verification?.can_take_photo && user && !result);
  const canSubmit = Boolean(canCapture && location && photo && token && !isSubmitting);

  useEffect(() => {
    if (!token) {
      return;
    }
    void apiRequest<Eligibility>("/submissions/eligibility", { token })
      .then(setEligibility)
      .catch(() => setEligibility(null));
  }, [token]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const photoMeta = useMemo(() => {
    if (!photo) return "촬영된 사진 없음";
    return `${photo.type} · ${(photo.size / 1024 / 1024).toFixed(2)}MB`;
  }, [photo]);

  function setNotice(text: string, type: "info" | "error" = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function requestLocation() {
    if (!hasQr) {
      setNotice("유효한 쓰레기통 QR이 필요합니다.", "error");
      return;
    }
    if (!navigator.geolocation) {
      setNotice("현재 브라우저에서 위치 확인을 지원하지 않습니다.", "error");
      return;
    }

    setIsLocating(true);
    setResult(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(currentLocation);
        const params = new URLSearchParams({
          bin_id: qr.binId,
          token: qr.token,
          latitude: String(currentLocation.latitude),
          longitude: String(currentLocation.longitude),
          accuracy_m: String(currentLocation.accuracy),
        });
        void apiRequest<QrVerification>(`/qr/verify?${params}`)
          .then((data) => {
            setVerification(data);
            setNotice(
              data.can_take_photo
                ? `쓰레기통 위치가 확인되었습니다. 거리 ${data.distance_m}m`
                : `허용 반경 밖입니다. 거리 ${data.distance_m}m`,
              data.can_take_photo ? "info" : "error",
            );
          })
          .catch((error) => {
            setVerification(null);
            setNotice(userFacingError(error, "위치 검증에 실패했습니다."), "error");
          })
          .finally(() => setIsLocating(false));
      },
      () => {
        setIsLocating(false);
        setNotice("위치 권한을 허용한 뒤 다시 시도해 주세요.", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function handlePhoto(file: File | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setResult(null);
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (!canCapture) {
      setNotice("위치 검증을 먼저 완료해 주세요.", "error");
      return;
    }
    if (!allowedImageTypes.includes(file.type)) {
      setNotice("jpg, png, webp 형식의 사진만 사용할 수 있습니다.", "error");
      return;
    }
    if (file.size > maxImageSizeMb * 1024 * 1024) {
      setNotice("사진 용량은 5MB 이하여야 합니다.", "error");
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setNotice("촬영한 사진을 확인한 뒤 제출해 주세요.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location || !photo || !token) return;

    const formData = new FormData();
    formData.append("bin_id", qr.binId);
    formData.append("token", qr.token);
    formData.append("latitude", String(location.latitude));
    formData.append("longitude", String(location.longitude));
    formData.append("accuracy_m", String(location.accuracy));
    formData.append("photo", photo);

    setIsSubmitting(true);
    setNotice("사진 인증을 처리하고 있습니다.");
    try {
      const data = await apiRequest<SubmissionCreateResult>("/submissions", {
        method: "POST",
        token,
        body: formData,
      });
      setResult(data);
      setNotice(data.message);
      await refreshUser();
      setEligibility((current) =>
        current ? { ...current, remaining_today: data.remaining_today } : current,
      );
    } catch (error) {
      setNotice(userFacingError(error, "사진 인증에 실패했습니다."), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progress = [
    { label: "QR", done: hasQr },
    { label: "계정", done: Boolean(user) },
    { label: "위치", done: Boolean(verification?.can_take_photo) },
    { label: "촬영", done: Boolean(photo) },
    { label: "완료", done: Boolean(result) },
  ];

  if (isLoading) {
    return <main className="page-shell"><div className="loading-panel">인증 화면 준비 중</div></main>;
  }

  return (
    <main className="page-shell verify-shell">
      <div className="page-heading">
        <div><p className="eyebrow">QR VERIFICATION</p><h1>분리배출 촬영 인증</h1><p>QR과 현재 위치가 확인되면 카메라 촬영이 활성화됩니다.</p></div>
      </div>

      <div className="verify-layout">
        <form className="surface verify-main" onSubmit={handleSubmit}>
          <div className="progress-track">
            {progress.map((step, index) => (
              <div className={step.done ? "done" : ""} key={step.label}>
                <span>{step.done ? <CheckCircle2 size={17} /> : index + 1}</span>
                <strong>{step.label}</strong>
              </div>
            ))}
          </div>

          {!hasQr ? (
            <div className="blocking-state"><QrCode size={32} /><h2>쓰레기통 QR이 필요합니다</h2><p>지정된 쓰레기통의 QR을 스캔해 다시 접속해 주세요.</p></div>
          ) : null}

          {hasQr && !user ? (
            <section className="verify-section">
              <div className="surface-heading"><div><span className="section-kicker">STEP 2</span><h2>외대 계정 확인</h2></div></div>
              <AccountForm />
            </section>
          ) : null}

          {hasQr && user ? (
            <>
              <section className="verify-section">
                <div className="surface-heading"><div><span className="section-kicker">STEP 3</span><h2>현재 위치 확인</h2></div><span className="inline-account">{user.email}</span></div>
                <button className="action-button secondary full" type="button" onClick={requestLocation} disabled={isLocating || Boolean(result)}>
                  {isLocating ? <RefreshCw className="spin" size={18} /> : <LocateFixed size={18} />}
                  {isLocating ? "위치 확인 중" : "현재 위치 확인"}
                </button>
                <div className="location-metrics">
                  <div><span>위도</span><strong>{location ? location.latitude.toFixed(6) : "-"}</strong></div>
                  <div><span>경도</span><strong>{location ? location.longitude.toFixed(6) : "-"}</strong></div>
                  <div><span>GPS 정확도</span><strong>{location ? `${location.accuracy.toFixed(1)}m` : "-"}</strong></div>
                </div>
              </section>

              <section className="verify-section">
                <div className="surface-heading"><div><span className="section-kicker">STEP 4</span><h2>배출 사진 촬영</h2></div></div>
                <input ref={cameraInputRef} className="camera-input" type="file" accept="image/*" capture="environment" disabled={!canCapture} onChange={(event) => handlePhoto(event.target.files?.[0])} />
                <button className="action-button secondary full camera-action" type="button" onClick={() => cameraInputRef.current?.click()} disabled={!canCapture}>
                  <Camera size={19} />{photo ? "다시 촬영" : "카메라로 촬영"}
                </button>
                <div className="photo-preview">
                  {previewUrl ? <Image src={previewUrl} alt="촬영한 분리배출 사진" fill unoptimized /> : <div><Camera size={30} /><span>{photoMeta}</span></div>}
                </div>
              </section>

              {message ? <div className={`notice ${messageType}`}>{message}</div> : null}

              <button className="action-button primary full submit-action" type="submit" disabled={!canSubmit}>
                <Send size={18} />{isSubmitting ? "인증 처리 중" : "사진 인증 제출"}
              </button>

              {result ? (
                <section className={`verification-result ${result.status.toLowerCase()}`}>
                  <div className="result-title"><span><CheckCircle2 size={26} /></span><div><h2>{result.status === "APPROVED" ? "인증되었습니다" : "인증이 접수되었습니다"}</h2><p>인증 번호 #{result.submission_id}</p></div></div>
                  <div className="approval-flow">
                    <div className="complete"><Camera size={18} /><strong>사진 제출</strong><span>완료</span></div>
                    <div className={result.status === "APPROVED" ? "complete" : "current"}><ShieldCheck size={18} /><strong>관리자 검토</strong><span>{result.status === "APPROVED" ? "승인" : "대기"}</span></div>
                    <div className={result.points_awarded ? "complete" : "pending"}><WalletCards size={18} /><strong>마일리지</strong><span>{result.points_awarded ? `+${result.points_awarded}P` : "승인 후"}</span></div>
                  </div>
                  <div className="result-balance"><span>{result.points_awarded ? `마일리지 ${result.points_awarded}점이 적립되었습니다` : "승인 후 마일리지가 적립됩니다"}</span><strong>{result.mileage_balance}P</strong></div>
                </section>
              ) : null}
            </>
          ) : null}
        </form>

        <aside className="verify-aside">
          <section className="surface compact-surface">
            <span className="section-kicker">TRASH BIN</span>
            <div className="bin-summary"><span><QrCode size={21} /></span><div><strong>{verification?.bin.name ?? (qr.binId || "QR 미확인")}</strong><small>{verification?.bin.description ?? "글로벌캠퍼스 지정 쓰레기통"}</small></div></div>
            <div className="aside-detail"><MapPin size={16} /><span>허용 반경</span><strong>{verification?.allowed_radius_m ?? "-"}m</strong></div>
          </section>
          <section className="surface compact-surface">
            <span className="section-kicker">TODAY</span>
            <div className="aside-detail"><CheckCircle2 size={16} /><span>남은 인증</span><strong>{eligibility?.remaining_today ?? "-"}회</strong></div>
            <div className="aside-detail"><Clock3 size={16} /><span>다음 가능</span><strong>{eligibility?.can_submit_now ? "지금" : formatDate(eligibility?.next_submission_at ?? null)}</strong></div>
          </section>
        </aside>
      </div>
    </main>
  );
}
