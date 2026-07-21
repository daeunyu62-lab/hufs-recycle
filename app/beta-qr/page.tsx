"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { BETA_SPOT } from "@/lib/spots";

export default function BetaQrPage() {
  const [targetUrl, setTargetUrl] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/check-in?spotId=${BETA_SPOT.id}`;
    QRCode.toDataURL(url, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#123D2C", light: "#FFFFFF" },
    })
      .then((image) => {
        setTargetUrl(url);
        setQrImage(image);
      })
      .catch(() => setError("QR코드를 생성하지 못했습니다. 페이지를 새로고침해 주세요."));
  }, []);

  return (
    <main className="qr-page">
      <AppHeader compact />
      <div className="qr-shell page-width">
        <section className="qr-intro">
          <span className="eyebrow">BETA TEST QR</span>
          <h1>휴대폰으로<br />체크인 흐름을 시작하세요.</h1>
          <p>이 QR은 현재 접속한 도메인을 자동으로 사용합니다. 배포 후에는 별도 수정 없이 배포 주소로 연결됩니다.</p>
          <dl className="qr-details">
            <div><dt>수거함</dt><dd>{BETA_SPOT.name}</dd></div>
            <div><dt>수거함 ID</dt><dd>{BETA_SPOT.id}</dd></div>
            <div><dt>인증 범위</dt><dd>{BETA_SPOT.radiusMeters}m 이내</dd></div>
          </dl>
          <Link className="text-link" href="/">← 서비스 소개로 돌아가기</Link>
        </section>

        <section className="qr-card">
          <div className="qr-card-topline"><span>HUFS ECO MILE</span><b>BETA</b></div>
          {error ? (
            <div className="permission-error" role="alert">{error}</div>
          ) : qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qr-image" src={qrImage} alt={`${BETA_SPOT.name} 체크인 QR코드`} />
          ) : (
            <div className="qr-loading" role="status"><div className="spinner" /><span>QR코드 생성 중</span></div>
          )}
          <strong>학생회관 분리수거함</strong>
          <p>휴대폰 기본 카메라로 QR코드를 촬영해주세요.</p>
          <div className="url-box" title={targetUrl}>{targetUrl || "연결 주소를 준비하고 있습니다"}</div>
          {qrImage && (
            <a className="button button-primary button-full" href={qrImage} download="hufs-global-001-beta-qr.png">
              QR코드 이미지 다운로드
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
