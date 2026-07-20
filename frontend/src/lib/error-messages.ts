import { ApiError } from "@/lib/api";

const messages: Record<string, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  EMAIL_NOT_VERIFIED: "외대 이메일 인증이 필요합니다.",
  INVALID_QR: "유효하지 않은 QR입니다. 쓰레기통의 QR을 다시 스캔해 주세요.",
  BIN_INACTIVE: "현재 사용할 수 없는 쓰레기통입니다.",
  LOCATION_TOO_FAR: "쓰레기통과 너무 멀리 떨어져 있습니다.",
  GPS_ACCURACY_TOO_LOW: "GPS 정확도가 낮습니다. 잠시 후 위치를 다시 확인해 주세요.",
  HOURLY_LIMIT: "최근 인증 후 60분이 지나야 다시 제출할 수 있습니다.",
  DAILY_LIMIT: "오늘 제출 가능한 횟수를 모두 사용했습니다.",
  INVALID_IMAGE: "촬영한 이미지 파일을 확인해 주세요.",
  IMAGE_TOO_LARGE: "사진 용량은 5MB 이하여야 합니다.",
  ADMIN_REQUIRED: "관리자 권한이 필요합니다.",
  ALREADY_REVIEWED: "이미 검토가 완료된 인증입니다.",
};

export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return (error.code && messages[error.code]) || error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
