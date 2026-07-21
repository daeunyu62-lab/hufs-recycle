"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { FlowProgress } from "@/components/FlowProgress";
import { hasValidQrGeoContext, RECYCLING_SPOTS, RecyclingSpot } from "@/lib/spots";
import {
  BetaData,
  EMPTY_BETA_DATA,
  getLocalDateKey,
  hasAuthenticatedToday,
  isHufsEmail,
  loadBetaData,
  saveBetaData,
} from "@/lib/storage";

type Stage =
  | "loading"
  | "invalid"
  | "login"
  | "identityChecking"
  | "identityComplete"
  | "location"
  | "locating"
  | "locationResult"
  | "camera"
  | "preview"
  | "authenticating"
  | "success"
  | "duplicate";

type LocationResult = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  verified: true;
} | null;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function stageProgress(stage: Stage) {
  if (["login", "identityChecking", "identityComplete", "loading", "invalid"].includes(stage)) return 1;
  if (["location", "locating", "locationResult"].includes(stage)) return 2;
  if (["camera", "preview", "authenticating"].includes(stage)) return 3;
  return 4;
}

export default function CheckInPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [spot, setSpot] = useState<RecyclingSpot | null>(null);
  const [data, setData] = useState<BetaData>(EMPTY_BETA_DATA);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [locationResult, setLocationResult] = useState<LocationResult>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedSpot = RECYCLING_SPOTS[params.get("spotId") ?? ""];
      if (!requestedSpot || !hasValidQrGeoContext(params, requestedSpot)) {
        setStage("invalid");
        return;
      }

      const storedData = loadBetaData();
      setSpot(requestedSpot);
      setData(storedData);
      setEmail(storedData.user?.email ?? "");
      setStage("login");
    }, 0);
    return () => window.clearTimeout(initializeTimer);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraStatus, stage]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isHufsEmail(normalizedEmail)) {
      setFormError("한국외대 이메일(@hufs.ac.kr)을 정확히 입력해 주세요.");
      return;
    }
    if (!agreed) {
      setFormError("개인정보 활용 동의가 필요합니다.");
      return;
    }

    setFormError("");
    setStage("identityChecking");
    await sleep(1_000);
    const nextData: BetaData = {
      ...data,
      user: {
        email: normalizedEmail,
        verifiedAt: new Date().toISOString(),
      },
    };
    saveBetaData(nextData);
    setData(nextData);
    setStage("identityComplete");
  };

  const continueAfterIdentity = () => {
    if (spot && hasAuthenticatedToday(data, spot.id)) {
      setStage("duplicate");
      return;
    }
    setStage("location");
  };

  const verifyQrLocation = async () => {
    if (!spot) return;
    setLocationResult(null);
    setStage("locating");
    await sleep(900);
    setLocationResult({
      latitude: spot.latitude,
      longitude: spot.longitude,
      radiusMeters: spot.radiusMeters,
      verified: true,
    });
    setStage("locationResult");
  };

  const startCamera = async () => {
    setCameraStatus("requesting");
    setCameraError("");
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("이 브라우저에서는 웹 카메라를 바로 열 수 없습니다. 아래의 사진 선택 기능을 이용해 주세요.");
      setCameraStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStatus("active");
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      const message =
        errorName === "NotAllowedError"
          ? "카메라 권한이 거부되었습니다. 브라우저의 사이트 설정에서 카메라를 허용한 뒤 다시 시도해 주세요."
          : "카메라를 시작할 수 없습니다. 다른 앱에서 카메라를 사용 중인지 확인하거나 사진 선택 기능을 이용해 주세요.";
      setCameraError(message);
      setCameraStatus("error");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("카메라 화면을 준비하고 있습니다. 잠시 후 다시 촬영해 주세요.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("사진 미리보기를 만들 수 없습니다. 사진 선택 기능을 이용해 주세요.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoPreview(canvas.toDataURL("image/jpeg", 0.86));
    stopCamera();
    setStage("preview");
  };

  const handlePhotoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(String(reader.result));
      stopCamera();
      setStage("preview");
    };
    reader.onerror = () => setCameraError("사진을 불러오지 못했습니다. 다시 선택해 주세요.");
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setPhotoPreview(null);
    setCameraStatus("idle");
    setCameraError("");
    setStage("camera");
  };

  const authenticatePhoto = async () => {
    if (!spot || !photoPreview || isSubmitting) return;
    const latestData = loadBetaData();
    if (!latestData.user || !isHufsEmail(latestData.user.email)) {
      setStage("login");
      return;
    }
    if (hasAuthenticatedToday(latestData, spot.id)) {
      setData(latestData);
      setStage("duplicate");
      return;
    }

    setIsSubmitting(true);
    setStage("authenticating");
    await sleep(1_500);
    const createdAt = new Date();
    const record = {
      id: `${spot.id}-${createdAt.getTime()}`,
      spotId: spot.id,
      spotName: spot.name,
      points: 100,
      createdAt: createdAt.toISOString(),
      dateKey: getLocalDateKey(createdAt),
    };
    const nextData: BetaData = {
      ...latestData,
      points: latestData.points + 100,
      records: [record, ...latestData.records],
    };
    saveBetaData(nextData);
    setData(nextData);
    setIsSubmitting(false);
    setStage("success");
  };

  const openCameraStep = () => {
    if (!spot) return;
    const latestData = loadBetaData();
    if (!latestData.user || !isHufsEmail(latestData.user.email)) {
      setStage("login");
      return;
    }
    if (hasAuthenticatedToday(latestData, spot.id)) {
      setData(latestData);
      setStage("duplicate");
      return;
    }
    setStage("camera");
  };

  return (
    <main className="flow-page">
      <AppHeader compact />
      <div className="flow-shell">
        <FlowProgress current={stageProgress(stage)} />

        {stage === "loading" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="spinner" />
            <h1>QR 정보를 확인하고 있습니다</h1>
            <p>잠시만 기다려 주세요.</p>
          </section>
        )}

        {stage === "invalid" && (
          <section className="flow-card centered-card" role="alert">
            <div className="status-symbol status-error" aria-hidden="true">!</div>
            <span className="card-kicker">QR 확인 실패</span>
            <h1>유효하지 않은 QR코드입니다</h1>
            <p>체크인 주소와 GPS 정보가 포함된 공식 QR코드를 다시 촬영해 주세요.</p>
            <a className="button button-primary button-full" href="/beta-qr">베타 QR 확인하기</a>
            <Link className="text-link" href="/">홈으로 돌아가기</Link>
          </section>
        )}

        {stage === "login" && (
          <section className="flow-card">
            <div className="card-heading">
              <span className="card-kicker">STEP 1 · 학교 이메일 로그인</span>
              <h1>한국외대 이메일로 로그인해 주세요.</h1>
              <p>학교 구성원 확인을 위해 @hufs.ac.kr 이메일만 사용할 수 있습니다.</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>한국외대 이메일</span>
                <input
                  autoComplete="email"
                  data-testid="email-input"
                  inputMode="email"
                  placeholder="student@hufs.ac.kr"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="consent-row">
                <input
                  checked={agreed}
                  data-testid="consent-checkbox"
                  type="checkbox"
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>
                  개인정보 활용에 동의합니다.
                  <small>이메일과 적립 내역은 이 기기의 베타테스트 데이터로만 저장됩니다.</small>
                </span>
              </label>
              {formError && <p className="inline-error" role="alert">{formError}</p>}
              <button className="button button-primary button-full" type="submit">
                학교 이메일로 로그인
              </button>
              <p className="form-caption">실제 메일 인증을 전송하지 않는 베타테스트용 로그인입니다.</p>
            </form>
          </section>
        )}

        {stage === "identityChecking" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="spinner" />
            <span className="card-kicker">학교 계정 확인 중</span>
            <h1>HUFS 이메일을 확인하고 있습니다</h1>
            <p>잠시만 기다려 주세요.</p>
          </section>
        )}

        {stage === "identityComplete" && (
          <section className="flow-card centered-card" role="status">
            <div className="status-symbol status-success" aria-hidden="true">✓</div>
            <span className="card-kicker">로그인 완료</span>
            <h1>학교 이메일이 확인되었습니다</h1>
            <p><strong>{data.user?.email}</strong><br />이제 QR코드에 담긴 GPS 정보를 확인할게요.</p>
            <button className="button button-primary button-full" onClick={continueAfterIdentity}>
              QR·GPS 정보 확인으로 계속
            </button>
          </section>
        )}

        {stage === "location" && spot && (
          <section className="flow-card">
            <div className="card-heading">
              <span className="card-kicker">STEP 2 · 위치확인</span>
              <h1>QR코드의 GPS 정보를 확인할게요.</h1>
              <p>이 QR에는 수거함 위치와 지오펜싱 범위가 함께 담겨 있습니다.</p>
            </div>
            <div className="spot-card">
              <div className="spot-pin" aria-hidden="true">◎</div>
              <div>
                <small>현재 접속한 수거함</small>
                <strong>{spot.name}</strong>
                <span>{spot.id}</span>
              </div>
            </div>
            <div className="privacy-note">
              <span aria-hidden="true">⌖</span>
              <p>시연에서는 QR에 포함된 위치 정보를 확인 완료로 처리하며 별도 위치 권한을 요청하지 않습니다.</p>
            </div>
            <button className="button button-primary button-full" data-testid="verify-qr-location" onClick={verifyQrLocation}>
              QR·GPS 정보 확인하기
            </button>
          </section>
        )}

        {stage === "locating" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="radar" aria-hidden="true"><span /></div>
            <span className="card-kicker">QR 지오펜싱 확인 중</span>
            <h1>QR의 GPS 정보를 확인하고 있습니다</h1>
            <p>수거함 좌표와 인증 가능 범위를 확인하는 중이에요.</p>
          </section>
        )}

        {stage === "locationResult" && spot && locationResult && (
          <section className="flow-card">
            <div className="centered-intro">
              <div className="status-symbol status-success" aria-hidden="true">✓</div>
              <span className="card-kicker">위치 확인 완료</span>
              <h1>GPS 정보가 확인되었습니다</h1>
              <p>인증 가능한 수거함 QR입니다. 사진 촬영을 진행해 주세요.</p>
            </div>
            <dl className="result-list">
              <div><dt>수거함</dt><dd>{spot.shortName}</dd></div>
              <div><dt>QR GPS 위도</dt><dd>{locationResult.latitude}</dd></div>
              <div><dt>QR GPS 경도</dt><dd>{locationResult.longitude}</dd></div>
              <div><dt>지오펜싱 범위</dt><dd>{locationResult.radiusMeters}m 이내</dd></div>
              <div><dt>검증 상태</dt><dd className="value-success">확인 완료</dd></div>
            </dl>
            <button className="button button-primary button-full" data-testid="open-camera-step" onClick={openCameraStep}>카메라 인증 시작</button>
          </section>
        )}

        {stage === "camera" && spot && (
          <section className="flow-card camera-card">
            <div className="card-heading compact-heading">
              <span className="card-kicker">STEP 3 · 사진인증</span>
              <h1>분리배출 사진을 촬영해 주세요</h1>
              <p>수거함과 배출 내용이 함께 보이도록 촬영하면 좋아요.</p>
            </div>
            <div className={`camera-frame ${cameraStatus === "active" ? "is-active" : ""}`}>
              <video ref={videoRef} autoPlay muted playsInline aria-label="카메라 미리보기" />
              {cameraStatus !== "active" && (
                <div className="camera-placeholder">
                  <span aria-hidden="true">▣</span>
                  <strong>{cameraStatus === "requesting" ? "카메라를 연결하고 있습니다" : "카메라가 아직 꺼져 있습니다"}</strong>
                  <small>모바일에서는 후면 카메라를 우선 사용합니다.</small>
                </div>
              )}
            </div>
            {cameraError && (
              <div className="permission-error" role="alert">
                <strong>카메라를 열 수 없어요</strong>
                <p>{cameraError}</p>
              </div>
            )}
            {cameraStatus === "active" ? (
              <button className="button button-primary button-full" onClick={capturePhoto}>사진 촬영</button>
            ) : (
              <button className="button button-primary button-full" disabled={cameraStatus === "requesting"} onClick={startCamera}>
                {cameraStatus === "requesting" ? "카메라 연결 중…" : cameraStatus === "error" ? "카메라 다시 시도" : "카메라 켜기"}
              </button>
            )}
            <label className="button button-secondary button-full file-button">
              사진 선택하기
              <input accept="image/*" capture="environment" data-testid="photo-input" type="file" onChange={handlePhotoFile} />
            </label>
            <p className="form-caption">사진은 서버에 전송하거나 저장하지 않습니다.</p>
          </section>
        )}

        {stage === "preview" && photoPreview && (
          <section className="flow-card camera-card">
            <div className="card-heading compact-heading">
              <span className="card-kicker">사진 미리보기</span>
              <h1>이 사진으로 인증할까요?</h1>
              <p>사진을 확인한 뒤 인증을 요청해 주세요.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo-preview" src={photoPreview} alt="촬영한 분리배출 사진 미리보기" />
            <div className="dual-actions">
              <button className="button button-secondary" onClick={retakePhoto}>다시 촬영</button>
              <button className="button button-primary" data-testid="authenticate-button" disabled={isSubmitting} onClick={authenticatePhoto}>인증 요청</button>
            </div>
          </section>
        )}

        {stage === "authenticating" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="scan-animation" aria-hidden="true"><span>▧</span><i /></div>
            <span className="card-kicker">인증 처리 중</span>
            <h1>사진을 확인하고 있습니다</h1>
            <p>분리배출 상태와 수거함을 확인하는 중이에요.</p>
          </section>
        )}

        {stage === "success" && spot && (
          <section className="flow-card centered-card success-card" role="status">
            <div className="success-confetti" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="status-symbol status-success status-large" aria-hidden="true">✓</div>
            <span className="card-kicker">인증 완료</span>
            <h1>분리배출 인증이 완료되었습니다</h1>
            <div className="reward-panel">
              <small>이번 적립</small>
              <strong><span>+</span>100 마일리지</strong>
              <p>현재 보유 {data.points.toLocaleString("ko-KR")} M</p>
            </div>
            <p>{spot.shortName}에서 친환경 실천을 완료했어요.</p>
            <a className="button button-primary button-full" href="/mypage">마이페이지에서 확인</a>
            <Link className="text-link" href="/">홈으로 돌아가기</Link>
          </section>
        )}

        {stage === "duplicate" && spot && (
          <section className="flow-card centered-card" role="alert">
            <div className="status-symbol status-warning" aria-hidden="true">i</div>
            <span className="card-kicker">중복 인증 안내</span>
            <h1>오늘 이미 인증한 수거함입니다</h1>
            <p>{spot.shortName}은 하루에 한 번만 마일리지를 적립할 수 있어요.</p>
            <a className="button button-primary button-full" href="/mypage">적립 내역 확인</a>
            <Link className="text-link" href="/">홈으로 돌아가기</Link>
          </section>
        )}
      </div>
    </main>
  );
}
