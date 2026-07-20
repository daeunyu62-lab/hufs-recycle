"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { API_BASE_URL, fetchHealth } from "@/lib/api";

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type ApiErrorPayload = {
  detail?: {
    message?: string;
  };
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeMb = 5;

export function SubmissionConsole() {
  const [apiStatus, setApiStatus] = useState("확인 중");
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isAuthPending, setIsAuthPending] = useState(false);
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

  const canSubmit = Boolean(
    accessToken && qrToken.trim() && location && photo && !isSubmitting,
  );

  const photoMeta = useMemo(() => {
    if (!photo) {
      return "선택된 사진 없음";
    }

    return `${photo.type || "unknown"} · ${(photo.size / 1024 / 1024).toFixed(2)}MB`;
  }, [photo]);

  function apiErrorMessage(payload: ApiErrorPayload | null, fallback: string) {
    return payload?.detail?.message ?? fallback;
  }

  async function handleRegister() {
    if (!email || !studentNumber || !name || !password) {
      setMessageType("error");
      setMessage("이메일, 학번, 이름, 비밀번호를 입력해야 합니다.");
      return;
    }

    setIsAuthPending(true);
    setMessageType("info");
    setMessage("회원가입을 요청하고 있습니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          student_number: studentNumber,
          name,
          password,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, "회원가입에 실패했습니다."));
      }

      setVerificationToken(data.email_verification_token ?? "");
      setAccessToken("");
      setMessageType("info");
      setMessage("회원가입이 완료되었습니다. 이메일 인증을 진행해 주세요.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "회원가입에 실패했습니다.");
    } finally {
      setIsAuthPending(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verificationToken.trim()) {
      setMessageType("error");
      setMessage("이메일 인증 토큰을 입력해야 합니다.");
      return;
    }

    setIsAuthPending(true);
    setMessageType("info");
    setMessage("이메일 인증을 확인하고 있습니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, "이메일 인증에 실패했습니다."));
      }

      setMessageType("info");
      setMessage(data.message ?? "이메일 인증이 완료되었습니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error ? error.message : "이메일 인증에 실패했습니다.",
      );
    } finally {
      setIsAuthPending(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setMessageType("error");
      setMessage("이메일과 비밀번호를 입력해야 합니다.");
      return;
    }

    setIsAuthPending(true);
    setMessageType("info");
    setMessage("로그인하고 있습니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, "로그인에 실패했습니다."));
      }

      setAccessToken(data.access_token);
      setMessageType("info");
      setMessage("로그인되었습니다. 이제 인증 제출이 가능합니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    } finally {
      setIsAuthPending(false);
    }
  }

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
      setMessage("로그인, QR, 위치, 사진을 모두 확인해야 합니다.");
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
        headers: { Authorization: `Bearer ${accessToken}` },
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
            <div className="form-section">
              <div className="section-heading">
                <h3 className="section-title">외대 이메일 계정</h3>
                <span className={`auth-state ${accessToken ? "ready" : ""}`}>
                  {accessToken ? "로그인됨" : "로그인 필요"}
                </span>
              </div>

              <div className="auth-grid">
                <label className="field">
                  <span className="label">이메일</span>
                  <input
                    className="input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="student@hufs.ac.kr"
                    autoComplete="email"
                  />
                </label>
                <label className="field">
                  <span className="label">학번</span>
                  <input
                    className="input"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(event.target.value)}
                    placeholder="202400000"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="label">이름</span>
                  <input
                    className="input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="홍길동"
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span className="label">비밀번호</span>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8자 이상"
                    autoComplete="current-password"
                  />
                </label>
              </div>

              <label className="field">
                <span className="label">이메일 인증 토큰</span>
                <input
                  className="input"
                  value={verificationToken}
                  onChange={(event) => setVerificationToken(event.target.value)}
                  placeholder="개발 환경에서는 회원가입 응답으로 반환"
                  autoComplete="off"
                />
              </label>

              <div className="button-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleRegister}
                  disabled={isAuthPending}
                >
                  회원가입
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleVerifyEmail}
                  disabled={isAuthPending}
                >
                  이메일 인증
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={handleLogin}
                  disabled={isAuthPending}
                >
                  로그인
                </button>
              </div>
            </div>

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
                  <p className="step-title">계정 인증</p>
                  <p className="step-text">외대 이메일 인증 후 JWT 발급</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">2</span>
                <div>
                  <p className="step-title">QR 확인</p>
                  <p className="step-text">지정된 분리수거함 토큰 확인</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">3</span>
                <div>
                  <p className="step-title">위치 검증</p>
                  <p className="step-text">서버 기준 거리와 GPS 정확도 검증</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">4</span>
                <div>
                  <p className="step-title">관리자 검토</p>
                  <p className="step-text">사진 확인 후 승인 또는 거절</p>
                </div>
              </li>
              <li className="step">
                <span className="step-number">5</span>
                <div>
                  <p className="step-title">마일리지 적립</p>
                  <p className="step-text">승인된 제출에만 1점 적립</p>
                </div>
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
