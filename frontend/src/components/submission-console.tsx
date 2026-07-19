"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { API_BASE_URL, fetchHealth } from "@/lib/api";

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeMb = 5;

export function SubmissionConsole() {
  const [apiStatus, setApiStatus] = useState("확인 중");
  const [qrToken, setQrToken] = useState("");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((health) => setApiStatus(`${health.service} 연결됨`))
      .catch(() => setApiStatus("API 연결 대기"));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const canSubmit = Boolean(qrToken.trim() && location && photo && !isSubmitting);

  const photoMeta = useMemo(() => {
    if (!photo) {
      return "선택된 사진 없음";
    }

    return `${photo.type || "unknown"} · ${(photo.size / 1024 / 1024).toFixed(2)}MB`;
  }, [photo]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("현재 브라우저에서 위치 확인을 사용할 수 없습니다.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setMessageType("info");
        setMessage("위치 정보를 확인했습니다.");
        setIsLocating(false);
      },
      () => {
        setMessageType("error");
        setMessage("위치 권한을 확인하지 못했습니다.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  function handlePhotoChange(file: File | undefined) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }

    if (!allowedImageTypes.includes(file.type)) {
      setPhoto(null);
      setPreviewUrl(null);
      setMessageType("error");
      setMessage("jpg, png, webp 형식의 사진만 제출할 수 있습니다.");
      return;
    }

    if (file.size > maxImageSizeMb * 1024 * 1024) {
      setPhoto(null);
      setPreviewUrl(null);
      setMessageType("error");
      setMessage("사진 용량은 5MB 이하여야 합니다.");
      return;
    }

    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessageType("info");
    setMessage("사진을 확인했습니다.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!location || !photo) {
      setMessageType("error");
      setMessage("QR, 위치, 사진을 모두 확인해야 합니다.");
      return;
    }

    const formData = new FormData();
    formData.append("qr_token", qrToken.trim());
    formData.append("latitude", String(location.latitude));
    formData.append("longitude", String(location.longitude));
    formData.append("accuracy_m", String(location.accuracy));
    formData.append("photo", photo);

    setIsSubmitting(true);
    setMessageType("info");
    setMessage("인증을 제출하고 있습니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/submissions`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail = data?.detail?.message ?? "제출 API 응답을 확인해 주세요.";
        throw new Error(detail);
      }

      setMessageType("info");
      setMessage(data?.message ?? "인증이 제출되었습니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "제출에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">HR</div>
          <div>
            <h1 className="brand-title">HUFS Recycle</h1>
            <p className="brand-subtitle">분리배출 인증</p>
          </div>
        </div>
        <div className="status-pill" aria-live="polite">
          <span className="status-dot" />
          {apiStatus}
        </div>
      </header>

      <div className="main-grid">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">인증 제출</h2>
          </div>
          <form className="panel-body" onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">QR 토큰</span>
              <input
                className="input"
                value={qrToken}
                onChange={(event) => setQrToken(event.target.value)}
                placeholder="QR 코드의 토큰"
                autoComplete="off"
              />
            </label>

            <div className="field">
              <span className="label">현재 위치</span>
              <div className="button-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={requestLocation}
                  disabled={isLocating}
                >
                  {isLocating ? "확인 중" : "위치 확인"}
                </button>
              </div>
              <div className="location-grid">
                <div className="metric">
                  <p className="metric-label">위도</p>
                  <p className="metric-value">
                    {location ? location.latitude.toFixed(6) : "-"}
                  </p>
                </div>
                <div className="metric">
                  <p className="metric-label">경도</p>
                  <p className="metric-value">
                    {location ? location.longitude.toFixed(6) : "-"}
                  </p>
                </div>
                <div className="metric">
                  <p className="metric-label">정확도</p>
                  <p className="metric-value">
                    {location ? `${location.accuracy.toFixed(1)}m` : "-"}
                  </p>
                </div>
              </div>
            </div>

            <label className="field">
              <span className="label">배출 사진</span>
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => handlePhotoChange(event.target.files?.[0])}
              />
            </label>

            <div className="preview">
              {previewUrl ? (
                <Image
                  className="preview-image"
                  src={previewUrl}
                  alt="선택한 배출 인증 사진"
                  fill
                  unoptimized
                />
              ) : (
                <span className="preview-empty">{photoMeta}</span>
              )}
            </div>

            {previewUrl ? <div className="message info">{photoMeta}</div> : null}
            {message ? <div className={`message ${messageType}`}>{message}</div> : null}

            <button className="button primary" type="submit" disabled={!canSubmit}>
              {isSubmitting ? "제출 중" : "인증 제출"}
            </button>
          </form>
        </section>

        <aside className="panel side-panel">
          <div className="panel-header">
            <h2 className="panel-title">처리 상태</h2>
          </div>
          <div className="panel-body">
            <ol className="steps">
              <li className="step">
                <span className="step-number">1</span>
                <div>
                  <p className="step-title">QR 확인</p>
                  <p className="step-text">지정된 분리수거함 토큰 확인</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">2</span>
                <div>
                  <p className="step-title">위치 검증</p>
                  <p className="step-text">서버 기준 거리와 GPS 정확도 검증</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">3</span>
                <div>
                  <p className="step-title">관리자 검토</p>
                  <p className="step-text">승인 시 마일리지 1점 적립</p>
                </div>
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
