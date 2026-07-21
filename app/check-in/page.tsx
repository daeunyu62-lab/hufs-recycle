"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { FlowProgress } from "@/components/FlowProgress";
import { formatDistance, haversineDistanceMeters } from "@/lib/geo";
import { RECYCLING_SPOTS, RecyclingSpot } from "@/lib/spots";
import {
  BetaData,
  EMPTY_BETA_DATA,
  getLocalDateKey,
  hasAuthenticatedToday,
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
  distance: number;
  accuracy: number;
  allowed: boolean;
  source: "gps" | "test";
} | null;

const showBetaTools =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_BETA_TOOLS === "true";

const sleep = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function stageProgress(stage: Stage) {
  if (["login", "identityChecking", "identityComplete", "loading", "invalid"].includes(stage)) return 1;
  if (["location", "locating", "locationResult"].includes(stage)) return 2;
  if (["camera", "preview", "authenticating"].includes(stage)) return 3;
  return 4;
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "위치 권한이 거부되었습니다. 브라우저 주소창의 사이트 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "현재 위치 신호를 확인할 수 없습니다. GPS 또는 Wi-Fi를 켜고 창가나 야외에서 다시 시도해 주세요.";
  }
  if (error.code === error.TIMEOUT) {
    return "위치 확인 시간이 초과되었습니다. 네트워크와 GPS 상태를 확인한 뒤 다시 시도해 주세요.";
  }
  return "위치를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function CheckInPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [spot, setSpot] = useState<RecyclingSpot | null>(null);
  const [data, setData] = useState<BetaData>(EMPTY_BETA_DATA);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [locationResult, setLocationResult] = useState<LocationResult>(null);
  const [locationError, setLocationError] = useState("");
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
      if (!requestedSpot) {
        setStage("invalid");
        return;
      }

      const storedData = loadBetaData();
      setSpot(requestedSpot);
      setData(storedData);
      if (!storedData.user) {
        setStage("login");
      } else if (hasAuthenticatedToday(storedData, requestedSpot.id)) {
        setStage("duplicate");
      } else {
        setStage("location");
      }
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
    const normalizedName = name.trim();
    const normalizedStudentId = studentId.trim();
    if (!normalizedName || !normalizedStudentId || !agreed) {
      setFormError("이름, 학번, 필수 동의를 모두 확인해 주세요.");
      return;
    }

    setFormError("");
    setStage("identityChecking");
    await sleep(1_000);
    const nextData: BetaData = {
      ...data,
      user: {
        name: normalizedName,
        studentId: normalizedStudentId,
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

  const applyCoordinates = (
    latitude: number,
    longitude: number,
    accuracy: number,
    source: "gps" | "test",
  ) => {
    if (!spot) return;
    const distance = haversineDistanceMeters(
      { latitude, longitude },
      { latitude: spot.latitude, longitude: spot.longitude },
    );
    setLocationError("");
    setLocationResult({
      distance,
      accuracy,
      allowed: distance <= spot.radiusMeters,
      source,
    });
    setStage("locationResult");
  };

  const requestLocation = () => {
    setLocationError("");
    setLocationResult(null);
    setStage("locating");
    if (!("geolocation" in navigator)) {
      setLocationError("이 브라우저는 위치 확인을 지원하지 않습니다. 최신 모바일 브라우저에서 다시 시도해 주세요.");
      setStage("locationResult");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          "gps",
        );
      },
      (error) => {
        setLocationError(locationErrorMessage(error));
        setStage("locationResult");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const useTestLocation = () => {
    if (!spot) return;
    applyCoordinates(spot.latitude + 0.00002, spot.longitude, 5, "test");
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
            <p>수거함에 부착된 공식 QR코드를 다시 촬영해 주세요.</p>
            <a className="button button-primary button-full" href="/beta-qr">베타 QR 확인하기</a>
            <Link className="text-link" href="/">홈으로 돌아가기</Link>
          </section>
        )}

        {stage === "login" && (
          <section className="flow-card">
            <div className="card-heading">
              <span className="card-kicker">STEP 1 · 본인확인</span>
              <h1>반가워요! 먼저 본인정보를 확인할게요.</h1>
              <p>입력 정보는 이 기기의 베타테스트 데이터로만 저장됩니다.</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>이름</span>
                <input
                  autoComplete="name"
                  data-testid="name-input"
                  placeholder="홍길동"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                <span>학번</span>
                <input
                  autoComplete="off"
                  data-testid="student-id-input"
                  inputMode="numeric"
                  placeholder="202600000"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
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
                  개인정보 및 위치정보 활용에 동의합니다.
                  <small>베타테스트 진행과 위치 인증에만 사용됩니다.</small>
                </span>
              </label>
              {formError && <p className="inline-error" role="alert">{formError}</p>}
              <button className="button button-primary button-full" type="submit">
                로그인 및 본인확인
              </button>
              <p className="form-caption">베타테스트용 간편 본인확인</p>
            </form>
          </section>
        )}

        {stage === "identityChecking" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="spinner" />
            <span className="card-kicker">본인확인 처리 중</span>
            <h1>입력한 정보를 확인하고 있습니다</h1>
            <p>잠시만 기다려 주세요.</p>
          </section>
        )}

        {stage === "identityComplete" && (
          <section className="flow-card centered-card" role="status">
            <div className="status-symbol status-success" aria-hidden="true">✓</div>
            <span className="card-kicker">본인확인 완료</span>
            <h1>본인확인이 완료되었습니다</h1>
            <p><strong>{data.user?.name}</strong>님, 이제 수거함과의 거리를 확인할게요.</p>
            <button className="button button-primary button-full" onClick={continueAfterIdentity}>
              위치 확인으로 계속
            </button>
          </section>
        )}

        {stage === "location" && spot && (
          <section className="flow-card">
            <div className="card-heading">
              <span className="card-kicker">STEP 2 · 위치확인</span>
              <h1>수거함 가까이에 계신가요?</h1>
              <p>브라우저의 위치 권한을 허용하면 수거함까지의 거리를 계산합니다.</p>
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
              <p>현재 위치는 거리 계산에만 사용되며 저장하거나 전송하지 않습니다.</p>
            </div>
            <button className="button button-primary button-full" onClick={requestLocation}>
              현재 위치 확인하기
            </button>
            {showBetaTools && (
              <button className="button button-test button-full" data-testid="test-location" onClick={useTestLocation}>
                테스트 위치 사용
                <small>개발·발표 전용</small>
              </button>
            )}
          </section>
        )}

        {stage === "locating" && (
          <section className="flow-card centered-card" role="status" aria-live="polite">
            <div className="radar" aria-hidden="true"><span /></div>
            <span className="card-kicker">GPS 연결 중</span>
            <h1>현재 위치를 확인하고 있습니다</h1>
            <p>위치 확인에는 몇 초 정도 걸릴 수 있어요.</p>
          </section>
        )}

        {stage === "locationResult" && spot && (
          <section className="flow-card">
            {locationError ? (
              <>
                <div className="centered-intro">
                  <div className="status-symbol status-error" aria-hidden="true">!</div>
                  <span className="card-kicker">위치 확인 실패</span>
                  <h1>현재 위치를 확인하지 못했습니다</h1>
                  <p>{locationError}</p>
                </div>
                <button className="button button-primary button-full" onClick={requestLocation}>위치 다시 확인</button>
                {showBetaTools && (
                  <button className="button button-test button-full" data-testid="test-location" onClick={useTestLocation}>
                    테스트 위치 사용 <small>개발·발표 전용</small>
                  </button>
                )}
              </>
            ) : locationResult ? (
              <>
                <div className="centered-intro">
                  <div className={`status-symbol ${locationResult.allowed ? "status-success" : "status-warning"}`} aria-hidden="true">
                    {locationResult.allowed ? "✓" : "↗"}
                  </div>
                  <span className="card-kicker">위치 확인 완료</span>
                  <h1>{locationResult.allowed ? "인증 가능한 위치입니다" : "수거함과 거리가 멀어요"}</h1>
                  <p>{locationResult.allowed ? "사진 촬영을 진행해 주세요." : "수거함 가까이에서 다시 시도해주세요."}</p>
                </div>
                <dl className="result-list">
                  <div><dt>수거함</dt><dd>{spot.shortName}</dd></div>
                  <div><dt>수거함까지 거리</dt><dd className={locationResult.allowed ? "value-success" : "value-danger"}>{formatDistance(locationResult.distance)}</dd></div>
                  <div><dt>인증 가능 범위</dt><dd>{spot.radiusMeters}m 이내</dd></div>
                  <div><dt>GPS 정확도</dt><dd>±{Math.round(locationResult.accuracy)}m</dd></div>
                  <div><dt>위치 방식</dt><dd>{locationResult.source === "test" ? "테스트 위치" : "실제 GPS"}</dd></div>
                </dl>
                {locationResult.allowed ? (
                  <button className="button button-primary button-full" onClick={openCameraStep}>사진 촬영하기</button>
                ) : (
                  <button className="button button-primary button-full" onClick={requestLocation}>위치 다시 확인</button>
                )}
              </>
            ) : null}
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
