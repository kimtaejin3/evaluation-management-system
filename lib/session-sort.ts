// 분과 테이블 정렬(분과명·평가 기간) — 분과 목록·실시간 모니터링 공용.
// 기본 정렬(정렬 미지정)은 호출부의 기존 순서(createdAt)를 유지한다.
export type SessionSortField = "name" | "period";

export interface SortableSession {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  eventDate: Date | null;
}

export function parseSessionSort(searchParams: { sort?: string; dir?: string }): {
  sort?: SessionSortField;
  dir: "asc" | "desc";
} {
  const sort = searchParams.sort === "name" || searchParams.sort === "period" ? searchParams.sort : undefined;
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  return { sort, dir };
}

export function sortSessions<T extends SortableSession>(sessions: T[], sort?: SessionSortField, dir: "asc" | "desc" = "asc"): T[] {
  if (!sort) return sessions;
  const sign = dir === "desc" ? -1 : 1;
  return [...sessions].sort((a, b) => {
    if (sort === "name") return sign * a.name.localeCompare(b.name, "ko");
    // 평가 기간: 시작일(없으면 평가일→종료일) 기준, 미정은 항상 마지막
    const key = (s: SortableSession) =>
      (s.startDate ?? s.eventDate ?? s.endDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return 0;
    if (ka === Number.POSITIVE_INFINITY) return 1;
    if (kb === Number.POSITIVE_INFINITY) return -1;
    return sign * (ka - kb);
  });
}
