export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type UserRole = "USER" | "ADMIN";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type UserProfile = {
  id: number;
  email: string;
  student_number: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  email_verified_at: string | null;
  mileage_balance: number;
};

export type Submission = {
  id: number;
  user_id: number;
  location_id: number;
  location_code: string;
  location_name: string;
  image_path: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  distance_m: number;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
  rejection_reason: string | null;
};

export type AdminSubmission = Submission & {
  user_email: string;
  user_student_number: string;
  user_name: string;
  image_url?: string | null;
};

export type SubmissionList = {
  items: Submission[];
  page: number;
  page_size: number;
  total: number;
};

export type AdminSubmissionList = Omit<SubmissionList, "items"> & {
  items: AdminSubmission[];
};

export type PointTransaction = {
  id: number;
  submission_id: number | null;
  amount: number;
  transaction_type: "EARN" | "USE" | "CANCEL";
  description: string;
  created_at: string;
};

export type PointBalance = {
  balance: number;
  transactions: PointTransaction[];
  page: number;
  page_size: number;
  total: number;
};

export type Eligibility = {
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  cooldown_minutes: number;
  next_submission_at: string | null;
  can_submit_now: boolean;
};

export type QrVerification = {
  bin: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    allowed_radius_m: number;
    is_active: boolean;
  };
  distance_m: number;
  allowed_radius_m: number;
  gps_accuracy_m: number;
  can_take_photo: boolean;
};

export type SubmissionCreateResult = {
  submission_id: number;
  status: SubmissionStatus;
  distance_m: number;
  remaining_today: number;
  points_awarded: number;
  mileage_balance: number;
  message: string;
};

export type AdminStatistics = {
  total_submissions: number;
  pending_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  today_submissions: number;
  today_approved: number;
  active_users: number;
  total_points_awarded: number;
  submissions_by_location: Array<{ location_name: string; count: number }>;
};

export type AdminLocation = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  allowed_radius_m: number;
  qr_token: string;
  qr_secret_version: number;
  qr_url: string | null;
  is_active: boolean;
};

export type HealthResponse = {
  status: string;
  service: string;
  environment: string;
};

type ErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
    context?: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  code?: string;
  status: number;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

type ApiRequestOptions = RequestInit & {
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    throw new ApiError(
      payload?.detail?.message ?? `요청을 처리하지 못했습니다. (${response.status})`,
      response.status,
      payload?.detail?.code,
      payload?.detail?.context,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  if (API_BASE_URL.startsWith("http")) {
    return `${new URL(API_BASE_URL).origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}
