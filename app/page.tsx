import { AppHeader } from "@/components/AppHeader";

import { buildBetaCheckInPath } from "@/lib/spots";

const DEMO_CHECK_IN_URL = buildBetaCheckInPath();

const steps = [
  {
    number: "01",
    title: "QR로 수거함 확인",
    description: "수거함에 부착된 QR을 휴대폰 카메라로 스캔해요.",
  },
  {
    number: "02",
    title: "위치와 배출 사진 인증",
    description: "수거함 100m 안에서 위치를 확인하고 사진을 촬영해요.",
  },
  {
    number: "03",
    title: "마일리지 적립",
    description: "인증이 끝나면 즉시 100 마일리지를 받아요.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <AppHeader />
      <section className="landing-hero page-width">
        <div className="hero-copy">
          <span className="eyebrow">HUFS GLOBAL CAMPUS · BETA</span>
          <h1>
            버리는 순간이
            <br />
            캠퍼스의 변화가 되도록
          </h1>
          <p>
            올바른 분리배출을 사진으로 인증하고 마일리지를 쌓아보세요.
            별도 앱 설치 없이 QR 하나로 시작할 수 있습니다.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={DEMO_CHECK_IN_URL}>
              데모 체크인 시작
              <span aria-hidden="true">→</span>
            </a>
            <a className="button button-secondary" href="/beta-qr">
              베타 QR 보기
            </a>
          </div>
          <p className="beta-caption">
            발표·베타테스트용 프론트엔드 프로토타입입니다.
          </p>
        </div>

        <div className="hero-visual" aria-label="서비스 이용 흐름 미리보기">
          <div className="eco-orbit eco-orbit-one" />
          <div className="eco-orbit eco-orbit-two" />
          <div className="phone-card">
            <div className="phone-topline">
              <span>HUFS ECO MILE</span>
              <span className="live-dot">BETA</span>
            </div>
            <div className="phone-illustration" aria-hidden="true">
              <span className="leaf leaf-left">●</span>
              <span className="recycle-mark">♻</span>
              <span className="leaf leaf-right">●</span>
            </div>
            <p className="phone-kicker">오늘의 친환경 실천</p>
            <strong>분리배출을 인증해 주세요</strong>
            <div className="phone-reward">
              <span>적립 예정</span>
              <b>+100 M</b>
            </div>
            <div className="phone-button">QR 체크인</div>
          </div>
          <div className="floating-badge floating-badge-left">
            <span aria-hidden="true">◎</span>
            <div>
              <small>인증 범위</small>
              <strong>100m 이내</strong>
            </div>
          </div>
          <div className="floating-badge floating-badge-right">
            <span aria-hidden="true">＋</span>
            <div>
              <small>이번 적립</small>
              <strong>100 마일리지</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section page-width" aria-labelledby="how-title">
        <div className="section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2 id="how-title">세 단계면 충분해요</h2>
          <p>로그인부터 적립까지, 발표 화면에서도 자연스럽게 이어집니다.</p>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="campus-banner page-width">
        <div>
          <span className="eyebrow eyebrow-light">HUFS ECO MILE</span>
          <h2>우리의 작은 실천이 더 푸른 캠퍼스를 만듭니다.</h2>
        </div>
        <a className="button button-light" href={DEMO_CHECK_IN_URL}>
          지금 체험하기
        </a>
      </section>

      <footer className="site-footer page-width">
        <strong>HUFS ECO MILE</strong>
        <span>한국외국어대학교 분리배출 마일리지 베타</span>
      </footer>
    </main>
  );
}
