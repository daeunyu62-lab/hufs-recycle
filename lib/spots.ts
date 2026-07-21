export type RecyclingSpot = {
  id: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

// 발표용 샘플 좌표입니다. 실제 운영 시 현장 측량값으로 이 설정만 교체합니다.
export const RECYCLING_SPOTS: Record<string, RecyclingSpot> = {
  "HUFS-GLOBAL-001": {
    id: "HUFS-GLOBAL-001",
    name: "한국외대 글로벌캠퍼스 학생회관 분리수거함",
    shortName: "학생회관 분리수거함",
    latitude: 37.337739,
    longitude: 127.268589,
    radiusMeters: 100,
  },
};

export const BETA_SPOT = RECYCLING_SPOTS["HUFS-GLOBAL-001"];

export function buildBetaCheckInPath() {
  const params = new URLSearchParams({
    spotId: BETA_SPOT.id,
    geo: "verified",
    lat: String(BETA_SPOT.latitude),
    lng: String(BETA_SPOT.longitude),
    radius: String(BETA_SPOT.radiusMeters),
  });

  return `/check-in?${params.toString()}`;
}

export function hasValidQrGeoContext(params: URLSearchParams, spot: RecyclingSpot) {
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lng"));
  const radiusMeters = Number(params.get("radius"));

  return (
    params.get("geo") === "verified" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(radiusMeters) &&
    Math.abs(latitude - spot.latitude) < 0.000001 &&
    Math.abs(longitude - spot.longitude) < 0.000001 &&
    radiusMeters === spot.radiusMeters
  );
}
