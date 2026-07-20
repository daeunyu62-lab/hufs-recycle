"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL, fetchHealth } from "@/lib/api";

const SESSION_STORAGE_KEY = "hufs-recycle-access-token";
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeMb = 5;

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type UserProfile = {
  id: number;
  email: string;
  student_number: string;
  name: string;
  mileage_balance: number;
};

type SubmissionResult = {
  submission_id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  points_awarded: number;
  mileage_balance: number;
  message: string;
};

type ApiErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
  };
};

class ApiRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new ApiRequestError(
      data?.detail?.message ?? fallback,
      data?.detail?.code,
    );
  }
  return data as T;
}

function readInitialQueryValues() {
  if (typeof window === "undefined") {
    return { binId: "", qrToken: "", verificationToken: "" };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    binId: params.get("bin_id") ?? "",
    qrToken: params.get("token") ?? params.get("qr_token") ?? "",
    verificationToken: window.location.pathname.includes("verify-email")
      ? (params.get("token") ?? "")
      : "",
  };
}

export function SubmissionConsole() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [initialQuery] = useState(readInitialQueryValues);
  const [apiStatus, setApiStatus] = useState("확인 중");
  const [emailId, setEmailId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [isCheckingQr, setIsCheckingQr] = useState(false);
  const [canCapture, setCanCapture] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const binId = initialQuery.binId;
  const qrToken = initialQuery.qrToken;
  const hasQr = Boolean(binId && qrToken);

  useEffect(() => {
    fetchHealth()
      .then((health) => setApiStatus(`${health.service} 연결됨`))
      .catch(() => setApiStatus("API 연결 대기"));
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedToken) {
      return;
    }

    void fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((response) => readApiResponse<UserProfile>(response, "로그인 복원 실패"))
      .then((profile) => {
        setAccessToken(storedToken);
        setCurrentUser(profile);
        setEmailId(profile.email.split("@")[0]);
        setStudentNumber(profile.student_number);
      })
      .catch(() => window.localStorage.removeItem(SESSION_STORAGE_KEY));
  }, []);

  useEffect(() => {
    const token = initialQuery.verificationToken;
    if (!token) {
      return;
    }

    void fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) =>
        readApiResponse<{ message: string }>(response, "이메일 인증에 실패했습니다."),
      )
      .then(() => {
        setMessageType("info");
        setMessage("외대 이메일 인증이 완료되었습니다.");
      })
      .catch((error) => {
        setMessageType("error");
        setMessage(error instanceof Error ? error.message : "이메일 인증 실패");
      });
  }, [initialQuery.verificationToken]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const canSubmit = Boolean(
    accessToken && hasQr && location && photo && canCapture && !isSubmitting,
  );

  const photoMeta = useMemo(() => {
    if (!photo) {
      return "촬영된 사진 없음";
    }
    return `${photo.type || "unknown"} · ${(photo.size / 1024 / 1024).toFixed(2)}MB`;
  }, [photo]);

  function accountEmail() {
    return `${emailId.trim().toLowerCase()}@hufs.ac.kr`;
  }

  async function login(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return readApiResponse<{ access_token: string }>(
      response,
      "로그인에 실패했습니다.",
    );
  }

  async function verifyEmailToken(token: string) {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    await readApiResponse(response, "외대 이메일 인증에 실패했습니다.");
  }

  async function registerAndLogin(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        student_number: studentNumber.trim(),
        name: `외대 학생 ${studentNumber.trim()}`,
        password,
      }),
    });

    let data: { email_verification_token: string | null };
    try {
      data = await readApiResponse(response, "계정 등록에 실패했습니다.");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "EMAIL_ALREADY_EXISTS") {
        throw new Error("이미 등록된 이메일입니다. 비밀번호를 확인해 주세요.");
      }
      if (
        error instanceof ApiRequestError &&
        error.code === "STUDENT_NUMBER_ALREADY_EXISTS"
      ) {
        throw new Error("이미 등록된 학번입니다. 이메일을 확인해 주세요.");
      }
      throw error;
    }

    if (!data.email_verification_token) {
      throw new Error("외대 이메일로 발송된 인증 링크를 먼저 확인해 주세요.");
    }

    await verifyEmailToken(data.email_verification_token);
    return login(email);
  }

  async function recoverAndLogin(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await readApiResponse<{ email_verification_token: string | null }>(
      response,
      "이메일 인증을 다시 요청하지 못했습니다.",
    );

    if (!data.email_verification_token) {
      throw new Error("외대 이메일로 발송된 인증 링크를 먼저 확인해 주세요.");
    }

    await verifyEmailToken(data.email_verification_token);
    return login(email);
  }

  async function handleAccountStart() {
    if (!emailId.trim() || !studentNumber.trim() || password.length < 8) {
      setMessageType("error");
      setMessage("외대 이메일, 학번, 8자 이상의 비밀번호를 입력해 주세요.");
      return;
    }

    setIsAuthPending(true);
    setMessageType("info");
    setMessage("외대 계정을 확인하고 있습니다.");
    const email = accountEmail();

    try {
      let tokenResponse: { access_token: string };
      try {
        tokenResponse = await login(email);
      } catch (error) {
        if (!(error instanceof ApiRequestError)) {
          throw error;
        }
        if (error.code === "EMAIL_NOT_VERIFIED") {
          tokenResponse = await recoverAndLogin(email);
        } else if (error.code === "INVALID_CREDENTIALS") {
          tokenResponse = await registerAndLogin(email);
        } else {
          throw error;
        }
      }

      const profileResponse = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const profile = await readApiResponse<UserProfile>(
        profileResponse,
        "사용자 정보를 확인하지 못했습니다.",
      );
      if (profile.student_number !== studentNumber.trim()) {
        throw new Error("입력한 학번이 등록된 계정 정보와 일치하지 않습니다.");
      }

      window.localStorage.setItem(SESSION_STORAGE_KEY, tokenResponse.access_token);
      setAccessToken(tokenResponse.access_token);
      setCurrentUser(profile);
      setPassword("");
      setMessageType("info");
      setMessage("외대 계정으로 로그인되었습니다.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "계정 확인에 실패했습니다.");
    } finally {
      setIsAuthPending(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setAccessToken("");
    setCurrentUser(null);
    setCanCapture(false);
    setLocation(null);
    setSubmissionResult(null);
    setMessageType("info");
    setMessage("로그아웃되었습니다.");
  }

  async function verifyQrLocation(targetLocation: LocationState) {
    if (!hasQr) {
      setCanCapture(false);
      setMessageType("error");
      setMessage("지정된 쓰레기통 QR을 먼저 스캔해 주세요.");
      return;
    }

    const params = new URLSearchParams({
      bin_id: binId,
      token: qrToken,
      latitude: String(targetLocation.latitude),
      longitude: String(targetLocation.longitude),
      accuracy_m: String(targetLocation.accuracy),
    });

    setIsCheckingQr(true);
    try {
      const response = await fetch(`${API_BASE_URL}/qr/verify?${params}`, {
        cache: "no-store",
      });
      const data = await readApiResponse<{
        can_take_photo: boolean;
        distance_m: number;
      }>(response, "QR 위치 검증에 실패했습니다.");

      setCanCapture(data.can_take_photo);
      setMessageType(data.can_take_photo ? "info" : "error");
      setMessage(
        data.can_take_photo
          ? `쓰레기통 위치가 확인되었습니다. 거리 ${data.distance_m}m`
          : `허용 반경 밖입니다. 거리 ${data.distance_m}m`,
      );
    } catch (error) {
      setCanCapture(false);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "위치 검증에 실패했습니다.");
    } finally {
      setIsCheckingQr(false);
    }
  }

  function requestLocation() {
    if (!currentUser) {
      setMessageType("error");
      setMessage("외대 계정으로 먼저 시작해 주세요.");
      return;
    }
    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("현재 브라우저에서 위치 확인을 사용할 수 없습니다.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(nextLocation);
        void verifyQrLocation(nextLocation);
        setIsLocating(false);
      },
      () => {
        setMessageType("error");
        setMessage("위치 권한을 허용한 뒤 다시 시도해 주세요.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function handlePhotoChange(file: File | undefined) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSubmissionResult(null);

    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (!canCapture) {
      setPhoto(null);
      setPreviewUrl(null);
      setMessageType("error");
      setMessage("현재 위치 검증을 먼저 완료해 주세요.");
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
    setMessage("촬영한 사진을 확인한 뒤 제출해 주세요.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location || !photo) {
      setMessageType("error");
      setMessage("위치와 촬영 사진을 모두 확인해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("bin_id", binId);
    formData.append("token", qrToken);
    formData.append("latitude", String(location.latitude));
    formData.append("longitude", String(location.longitude));
    formData.append("accuracy_m", String(location.accuracy));
    formData.append("photo", photo);

    setIsSubmitting(true);
    setMessageType("info");
    setMessage("촬영 인증을 처리하고 있습니다.");

    try {
      const response = await fetch(`${API_BASE_URL}/submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await readApiResponse<SubmissionResult>(
        response,
        "인증 제출에 실패했습니다.",
      );

      setSubmissionResult(data);
      setCanCapture(false);
      setCurrentUser((user) =>
        user ? { ...user, mileage_balance: data.mileage_balance } : user,
      );
      setMessageType("info");
      setMessage(data.message);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "인증 제출에 실패했습니다.");
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
        <div className="topbar-actions">
          {currentUser ? (
            <div className="mileage-badge">{currentUser.mileage_balance}P</div>
          ) : null}
          <div className="status-pill" aria-live="polite">
            <span className="status-dot" />
            {apiStatus}
          </div>
        </div>
      </header>

      <div className="main-grid">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">분리배출 인증</h2>
          </div>
          <form className="panel-body" onSubmit={handleSubmit}>
            <div className="form-section">
              <div className="section-heading">
                <h3 className="section-title">외대 계정</h3>
                <span className={`auth-state ${currentUser ? "ready" : ""}`}>
                  {currentUser ? "로그인됨" : "계정 확인 필요"}
                </span>
              </div>

              {currentUser ? (
                <div className="account-summary">
                  <div>
                    <strong>{currentUser.email}</strong>
                    <span>학번 {currentUser.student_number}</span>
                  </div>
                  <button
                    className="button secondary compact"
                    type="button"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <>
                  <div className="account-grid">
                    <label className="field">
                      <span className="label">외대 이메일</span>
                      <span className="email-input-shell">
                        <input
                          className="email-prefix-input"
                          value={emailId}
                          onChange={(event) =>
                            setEmailId(event.target.value.split("@")[0])
                          }
                          placeholder="student"
                          autoComplete="username"
                        />
                        <span className="email-domain">@hufs.ac.kr</span>
                      </span>
                    </label>
                    <label className="field">
                      <span className="label">학번</span>
                      <input
                        className="input"
                        value={studentNumber}
                        onChange={(event) => setStudentNumber(event.target.value)}
                        placeholder="202400000"
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </label>
                    <label className="field account-password">
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
                  <button
                    className="button primary account-start-button"
                    type="button"
                    onClick={handleAccountStart}
                    disabled={isAuthPending}
                  >
                    {isAuthPending ? "계정 확인 중" : "외대 계정으로 시작"}
                  </button>
                </>
              )}
            </div>

            <div className="form-section verification-section">
              <div className="section-heading">
                <h3 className="section-title">QR 및 위치</h3>
                <span className={`stage-state ${hasQr ? "ready" : ""}`}>
                  {hasQr ? binId : "QR 필요"}
                </span>
              </div>

              <button
                className="button secondary location-button"
                type="button"
                onClick={requestLocation}
                disabled={!currentUser || !hasQr || isLocating || isCheckingQr}
              >
                {isLocating || isCheckingQr ? "현재 위치 확인 중" : "현재 위치 확인"}
              </button>

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
                  <p className="metric-label">GPS 정확도</p>
                  <p className="metric-value">
                    {location ? `${location.accuracy.toFixed(1)}m` : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="field">
              <span className="label">배출 사진</span>
              <input
                ref={cameraInputRef}
                className="camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={!canCapture}
                onChange={(event) => handlePhotoChange(event.target.files?.[0])}
              />
              <button
                className="button secondary camera-button"
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={!canCapture}
              >
                {photo ? "다시 촬영" : "카메라로 촬영"}
              </button>
            </div>

            <div className="preview">
              {previewUrl ? (
                <Image
                  className="preview-image"
                  src={previewUrl}
                  alt="촬영한 배출 인증 사진"
                  fill
                  unoptimized
                />
              ) : (
                <span className="preview-empty">{photoMeta}</span>
              )}
            </div>

            {message ? <div className={`message ${messageType}`}>{message}</div> : null}

            <button className="button primary submit-button" type="submit" disabled={!canSubmit}>
              {isSubmitting ? "인증 처리 중" : "사진 인증 제출"}
            </button>

            {submissionResult ? (
              <section className={`result-panel ${submissionResult.status.toLowerCase()}`}>
                <div className="result-heading">
                  <span className="result-mark">✓</span>
                  <div>
                    <h3>
                      {submissionResult.status === "APPROVED"
                        ? "인증되었습니다"
                        : "인증이 접수되었습니다"}
                    </h3>
                    <p>인증 번호 #{submissionResult.submission_id}</p>
                  </div>
                </div>
                <div className="result-steps">
                  <div className="result-step done">
                    <span>1</span>
                    <strong>촬영 인증 완료</strong>
                  </div>
                  <div
                    className={`result-step ${
                      submissionResult.status === "APPROVED" ? "done" : "current"
                    }`}
                  >
                    <span>2</span>
                    <strong>
                      {submissionResult.status === "APPROVED"
                        ? "관리자 승인 완료"
                        : "관리자 검토 대기"}
                    </strong>
                  </div>
                  <div
                    className={`result-step ${
                      submissionResult.points_awarded > 0 ? "done" : "pending"
                    }`}
                  >
                    <span>3</span>
                    <strong>
                      {submissionResult.points_awarded > 0
                        ? `마일리지 ${submissionResult.points_awarded}점 적립되었습니다`
                        : "승인 후 마일리지 적립"}
                    </strong>
                  </div>
                </div>
                <div className="balance-row">
                  <span>현재 마일리지</span>
                  <strong>{submissionResult.mileage_balance}P</strong>
                </div>
              </section>
            ) : null}
          </form>
        </section>

        <aside className="panel side-panel">
          <div className="panel-header">
            <h2 className="panel-title">진행 상태</h2>
          </div>
          <div className="panel-body">
            <ol className="steps">
              {[
                ["외대 계정", currentUser ? "완료" : "대기"],
                ["QR 스캔", hasQr ? "완료" : "대기"],
                ["위치 확인", canCapture || submissionResult ? "완료" : "대기"],
                ["사진 촬영", photo ? "완료" : "대기"],
                [
                  "마일리지 적립",
                  submissionResult?.points_awarded ? "완료" : "대기",
                ],
              ].map(([title, state], index) => (
                <li className={`step ${state === "완료" ? "complete" : ""}`} key={title}>
                  <span className="step-number">{index + 1}</span>
                  <div>
                    <p className="step-title">{title}</p>
                    <p className="step-text">{state}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
