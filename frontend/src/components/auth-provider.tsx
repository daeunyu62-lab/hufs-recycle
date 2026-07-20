"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { ApiError, apiRequest, UserProfile } from "@/lib/api";

const SESSION_STORAGE_KEY = "hufs-recycle-access-token";

type AccountInput = {
  emailId: string;
  studentNumber: string;
  password: string;
};

type AuthContextValue = {
  user: UserProfile | null;
  token: string;
  isLoading: boolean;
  isSubmitting: boolean;
  startAccount: (input: AccountInput) => Promise<UserProfile>;
  refreshUser: () => Promise<UserProfile | null>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acceptSession = useCallback((accessToken: string, profile: UserProfile) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, accessToken);
    setToken(accessToken);
    setUser(profile);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken("");
    setUser(null);
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedToken) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    void apiRequest<UserProfile>("/users/me", { token: storedToken })
      .then((profile) => acceptSession(storedToken, profile))
      .catch(clearSession)
      .finally(() => setIsLoading(false));
  }, [acceptSession, clearSession]);

  const refreshUser = useCallback(async () => {
    if (!token) {
      return null;
    }
    try {
      const profile = await apiRequest<UserProfile>("/users/me", { token });
      setUser(profile);
      return profile;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession, token]);

  async function login(email: string, password: string) {
    return apiRequest<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async function verifyEmail(verificationToken: string) {
    await apiRequest("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: verificationToken }),
    });
  }

  async function register(
    email: string,
    studentNumber: string,
    password: string,
  ) {
    const response = await apiRequest<{ email_verification_token: string | null }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          student_number: studentNumber,
          name: `외대 학생 ${studentNumber}`,
          password,
        }),
      },
    );
    if (!response.email_verification_token) {
      throw new Error("외대 이메일로 발송된 인증 링크를 확인해 주세요.");
    }
    await verifyEmail(response.email_verification_token);
    return login(email, password);
  }

  async function recover(email: string, password: string) {
    const response = await apiRequest<{ email_verification_token: string | null }>(
      "/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    if (!response.email_verification_token) {
      throw new Error("외대 이메일로 발송된 인증 링크를 확인해 주세요.");
    }
    await verifyEmail(response.email_verification_token);
    return login(email, password);
  }

  async function startAccount(input: AccountInput) {
    const emailId = input.emailId.trim().toLowerCase().split("@")[0];
    const studentNumber = input.studentNumber.trim();
    const email = `${emailId}@hufs.ac.kr`;
    setIsSubmitting(true);

    try {
      let session: { access_token: string };
      try {
        session = await login(email, input.password);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }
        if (error.code === "EMAIL_NOT_VERIFIED") {
          session = await recover(email, input.password);
        } else if (error.code === "INVALID_CREDENTIALS") {
          try {
            session = await register(email, studentNumber, input.password);
          } catch (registrationError) {
            if (
              registrationError instanceof ApiError &&
              registrationError.code === "EMAIL_ALREADY_EXISTS"
            ) {
              throw new Error("이미 등록된 이메일입니다. 비밀번호를 확인해 주세요.");
            }
            if (
              registrationError instanceof ApiError &&
              registrationError.code === "STUDENT_NUMBER_ALREADY_EXISTS"
            ) {
              throw new Error("이미 등록된 학번입니다. 이메일을 확인해 주세요.");
            }
            throw registrationError;
          }
        } else {
          throw error;
        }
      }

      const profile = await apiRequest<UserProfile>("/users/me", {
        token: session.access_token,
      });
      if (profile.student_number !== studentNumber) {
        throw new Error("입력한 학번이 계정 정보와 일치하지 않습니다.");
      }
      acceptSession(session.access_token, profile);
      return profile;
    } finally {
      setIsSubmitting(false);
    }
  }

  const value = {
    user,
    token,
    isLoading,
    isSubmitting,
    startAccount,
    refreshUser,
    signOut: clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
