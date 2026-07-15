// 분과 하위 탭 정의 — 사이드바 메뉴(AdminSidebar)와 페이지 헤더 탭 이름(SessionHeader)의 단일 출처.
export const SESSION_TABS = [
  { suffix: "", label: "실시간 진행 상황", desc: "분과 정보·실시간 모니터링" },
  { suffix: "/criteria", label: "평가 항목", desc: "과제 공통 항목 확인" },
  { suffix: "/subjects", label: "평가 대상", desc: "기업 편입·자료" },
  { suffix: "/evaluators", label: "평가 위원 섭외 현황", desc: "위원 배정·위원장" },
  { suffix: "/opinions", label: "평가 의견서", desc: "위원별 지원기업 종합 의견서" },
  { suffix: "/results", label: "집계 결과", desc: "순위·환산·등급 총괄표" },
] as const;

// 경로 접미사 → 탭 이름
export const SESSION_TAB_LABEL: Record<string, string> = Object.fromEntries(
  SESSION_TABS.map((t) => [t.suffix, t.label]),
);
