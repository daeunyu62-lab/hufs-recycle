'use client';

import React, { useState } from 'react';

// 간단한 SVG 아이콘 컴포넌트들 (설치 없이 바로 사용할 수 있도록 내장형으로 제작)
const CheckIcon = () => (
  <svg className="w-16 h-16 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const QrIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
);

export default function HomePage() {
  // 화면 전환을 위한 상태값 (state)
  // 'LOGIN' -> 'DASHBOARD' -> 'CAMERA'
  const [viewState, setViewState] = useState<'LOGIN' | 'DASHBOARD' | 'CAMERA'>('LOGIN');
  
  // 로그인한 유저 정보 및 마일리지 상태값
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [mileage, setMileage] = useState(1200); // 초기 마일리지 1200p
  
  // 적립 완료 모달/팝업 제어 상태값
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [accumulatedAmount, setAccumulatedAmount] = useState(0);

  // 카메라 촬영 가상 시뮬레이션 이미지 상태값
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // 1. 로그인 처리 함수
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.trim() === '') {
      alert('학번 또는 아이디를 입력해주세요!');
      return;
    }
    setIsLoggedIn(true);
    setViewState('DASHBOARD');
  };

  // 2. 가상 카메라 촬영 함수
  const handleCaptureSimulation = () => {
    // 실제 카메라 촬영본 대신, 예시 리사이클 이미지를 촬영 완료한 것처럼 세팅합니다.
    setCapturedImage('https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=600');
  };

  // 3. 사진 제출 및 마일리지 적립 완료 처리 함수 (재웅님 백엔드 완료 시점 호출)
  const handleSubmitVerification = () => {
    if (!capturedImage) {
      alert('인증할 사진을 먼저 촬영해주세요!');
      return;
    }

    // 마일리지 100p 추가 및 팝업창 세팅
    const earnAmount = 100;
    setAccumulatedAmount(earnAmount);
    setMileage((prev) => prev + earnAmount);
    
    // 모달창 띄우기
    setShowSuccessModal(true);
    
    // 모달이 켜지면 메인 대시보드로 백그라운드 전환하고 촬영 이미지 초기화
    setViewState('DASHBOARD');
    setCapturedImage(null);
  };

  // 4. 로그아웃 처리
  const handleLogout = () => {
    setIsLoggedIn(false);
    setStudentId('');
    setPassword('');
    setViewState('LOGIN');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans relative">
      
      {/* 글로벌 헤더 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
            <TrashIcon />
          </div>
          <span className="font-bold text-xl tracking-tight text-emerald-800">HUFS Recycle</span>
        </div>
        {isLoggedIn && (
          <button 
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-rose-600 border border-slate-200 px-2.5 py-1.5 rounded-md transition"
          >
            로그아웃
          </button>
        )}
      </header>

      {/* 중앙 메인 콘텐츠 영역 */}
      <main className="flex-grow flex items-center justify-center p-4">
        
        {/* =======================================
            [화면 1] 로그인 전 화면 (LOGIN)
           ======================================= */}
        {viewState === 'LOGIN' && (
          <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100 transition-all duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">캠퍼스를 더 푸르게 🍃</h2>
              <p className="text-sm text-slate-500">외대인을 위한 AI 분리배출 적립 서비스</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">학번 (Student ID)</label>
                <input 
                  type="text" 
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="202601234" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-base"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">비밀번호</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-base"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/10 transition duration-150 transform active:scale-95 text-base mt-2"
              >
                로그인하여 시작하기
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-xs text-slate-400">학번이 기억나지 않으시나요? </span>
              <a href="#" className="text-xs text-emerald-600 font-semibold underline">간편인증 찾기</a>
            </div>
          </div>
        )}

        {/* =======================================
            [화면 2] 로그인 후 메인 대시보드 (DASHBOARD)
           ======================================= */}
        {viewState === 'DASHBOARD' && (
          <div className="w-full max-w-md space-y-6 animate-fadeIn">
            {/* 상단 웰컴 메시지 및 마일리지 표시 카드 */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                <TrashIcon />
              </div>
              <p className="text-sm opacity-85">반가워요, 외대인님! 👋</p>
              <h3 className="text-xl font-bold mt-1 mb-6">{studentId || 'daeun'} 님</h3>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-75">나의 현재 누적 마일리지</p>
                  <p className="text-3xl font-black mt-1">{mileage.toLocaleString()} <span className="text-xl font-medium">p</span></p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  실시간 연동중
                </div>
              </div>
            </div>

            {/* 메인 기능 바둑판형 버튼 그리드 */}
            <div className="grid grid-cols-2 gap-4">
              {/* QR 인증 화면 이동 버튼 */}
              <button 
                onClick={() => alert('개인 인증 QR코드가 생성되었습니다. 리사이클 기기에 스캔해주세요!')}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-36"
              >
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl w-fit">
                  <QrIcon />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">QR코드 인증</h4>
                  <p className="text-xs text-slate-400 mt-1">기기에 QR 스캔하기</p>
                </div>
              </button>

              {/* 카메라 분리배출 촬영 버튼 */}
              <button 
                onClick={() => setViewState('CAMERA')}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-36 border-l-4 border-l-emerald-500"
              >
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl w-fit">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">카메라 촬영 인증</h4>
                  <p className="text-xs text-slate-400 mt-1">인증 사진 찍고 제출</p>
                </div>
              </button>
            </div>

            {/* 마일리지 적립 최근 히스토리 목록 UI */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                최근 마일리지 적립 현황
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-none">
                  <div>
                    <p className="text-xs text-slate-400">2026.07.20 23:15</p>
                    <p className="text-sm font-semibold text-slate-700">페트병 인공지능 수거함 완료</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+100p</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-none">
                  <div>
                    <p className="text-xs text-slate-400">2026.07.19 14:20</p>
                    <p className="text-sm font-semibold text-slate-700">종이팩 모바일 촬영 검증</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+100p</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-none">
                  <div>
                    <p className="text-xs text-slate-400">2026.07.18 11:05</p>
                    <p className="text-sm font-semibold text-slate-700">가입 기념 웰컴 마일리지</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+1,000p</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================
            [화면 3] 카메라 촬영 및 사진 제출 화면 (CAMERA)
           ======================================= */}
        {viewState === 'CAMERA' && (
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="text-sm font-bold">📷 분리배출 카메라 인증</span>
              <button 
                onClick={() => setViewState('DASHBOARD')}
                className="text-slate-400 hover:text-white transition text-sm"
              >
                닫기
              </button>
            </div>

            {/* 카메라 뷰파인더 가상 영역 */}
            <div className="aspect-[4/3] bg-slate-950 relative flex items-center justify-center">
              {capturedImage ? (
                <img 
                  src={capturedImage} 
                  alt="Captured Recycle Item" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto text-white animate-pulse">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">분리수거할 용기가 화면 정중앙에 선명히 위치하도록 비춰주세요.</p>
                </div>
              )}
            </div>

            {/* 조작 버튼 및 안내 */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
              {!capturedImage ? (
                <div className="space-y-3">
                  <button 
                    onClick={handleCaptureSimulation}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    가상 사진 촬영하기 (클릭)
                  </button>
                  <p className="text-[11px] text-center text-slate-400">※ 실제 카메라 연동 시에는 웹캠 모듈 및 MediaDevices API가 동작합니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setCapturedImage(null)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition"
                  >
                    다시 촬영
                  </button>
                  <button 
                    onClick={handleSubmitVerification}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md shadow-emerald-600/15 transition"
                  >
                    확인 및 제출하기
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* =======================================
          [화면 4] 마일리지 적립 및 인증 완료 성공 팝업 (MODAL)
         ======================================= */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-slate-100 text-center space-y-6 transform scale-100 transition-all">
            
            {/* 체크 모션 피드백 아이콘 */}
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckIcon />
            </div>

            {/* 성공 피드백 메시지 */}
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">제출 및 인증 성공!</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                올바른 분리배출이 정상 확인되었습니다.<br />환경 보호 활동에 감사드립니다! 🌿
              </p>
            </div>

            {/* 핵심 마일리지 수치 하이라이트 */}
            <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">누적된 마일리지</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">+{accumulatedAmount} <span className="text-lg font-bold">p</span></p>
              <div className="w-full h-px bg-emerald-100 my-2.5"></div>
              <p className="text-xs text-slate-500">현재 총 마일리지: <span className="font-bold text-slate-800">{mileage.toLocaleString()} p</span></p>
            </div>

            {/* 닫기 및 홈으로 이동 버튼 */}
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition duration-150 transform active:scale-95"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 글로벌 푸터 */}
      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200 bg-white">
        © 2026 HUFS Recycle Project. All rights reserved.
      </footer>
    </div>
  );
}
