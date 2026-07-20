"use client";

import { LogIn } from "lucide-react";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { userFacingError } from "@/lib/error-messages";

export function AccountForm({ onSuccess }: { onSuccess?: () => void }) {
  const { isSubmitting, startAccount } = useAuth();
  const [emailId, setEmailId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!emailId.trim() || !studentNumber.trim() || password.length < 8) {
      setError("외대 이메일, 학번, 8자 이상의 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await startAccount({ emailId, studentNumber, password });
      setPassword("");
      onSuccess?.();
    } catch (submitError) {
      setError(userFacingError(submitError, "계정을 확인하지 못했습니다."));
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <div className="account-form-grid">
        <label className="field">
          <span className="field-label">외대 이메일</span>
          <span className="email-control">
            <input
              value={emailId}
              onChange={(event) => setEmailId(event.target.value.split("@")[0])}
              placeholder="student"
              autoComplete="username"
            />
            <span>@hufs.ac.kr</span>
          </span>
        </label>
        <label className="field">
          <span className="field-label">학번</span>
          <input
            className="text-input"
            value={studentNumber}
            onChange={(event) => setStudentNumber(event.target.value)}
            placeholder="202400000"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className="field account-form-password">
          <span className="field-label">비밀번호</span>
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상"
            autoComplete="current-password"
          />
        </label>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <button className="action-button primary full" type="submit" disabled={isSubmitting}>
        <LogIn size={18} />
        {isSubmitting ? "계정 확인 중" : "외대 계정으로 시작"}
      </button>
    </form>
  );
}
