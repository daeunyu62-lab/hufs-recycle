export const BETA_STORAGE_KEY = "hufs-eco-mile-beta-v1";

export type BetaUser = {
  email: string;
  verifiedAt: string;
};

export type MileageRecord = {
  id: string;
  spotId: string;
  spotName: string;
  points: number;
  createdAt: string;
  dateKey: string;
};

export type BetaData = {
  user: BetaUser | null;
  points: number;
  records: MileageRecord[];
};

export const EMPTY_BETA_DATA: BetaData = {
  user: null,
  points: 0,
  records: [],
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadBetaData(): BetaData {
  if (!isBrowser()) return EMPTY_BETA_DATA;

  try {
    const raw = window.localStorage.getItem(BETA_STORAGE_KEY);
    if (!raw) return EMPTY_BETA_DATA;
    const parsed = JSON.parse(raw) as Partial<BetaData>;
    const storedUser = parsed.user as Partial<BetaUser> | undefined;
    return {
      user:
        storedUser && typeof storedUser.email === "string" && isHufsEmail(storedUser.email)
          ? {
              email: storedUser.email.toLowerCase(),
              verifiedAt:
                typeof storedUser.verifiedAt === "string"
                  ? storedUser.verifiedAt
                  : new Date().toISOString(),
            }
          : null,
      points: typeof parsed.points === "number" ? parsed.points : 0,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return EMPTY_BETA_DATA;
  }
}

export function isHufsEmail(value: string) {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@hufs\.ac\.kr$/i.test(value.trim());
}

export function saveBetaData(data: BetaData) {
  if (!isBrowser()) return;
  window.localStorage.setItem(BETA_STORAGE_KEY, JSON.stringify(data));
}

export function clearBetaData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(BETA_STORAGE_KEY);
}

export function hasAuthenticatedToday(data: BetaData, spotId: string) {
  const today = getLocalDateKey();
  return data.records.some(
    (record) => record.spotId === spotId && record.dateKey === today,
  );
}

export function formatRecordDate(isoDate: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}
