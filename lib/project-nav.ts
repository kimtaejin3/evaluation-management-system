// 사업(Project) 하위 페이지 정의 — 관리자 사이드바(AdminSidebar)의 단일 출처.
// 관리자는 분과 단위가 아니라 사업 단위로 아래 페이지들에서 분과들을 테이블 뷰로 한눈에 본다.
export const PROJECT_TABS = [
  { suffix: "", label: "분과 설정", desc: "분과·담당자 배정 현황" },
  { suffix: "/monitoring", label: "평가 실시간 모니터링", desc: "분과별 채점 진행 현황" },
  { suffix: "/criteria", label: "평가항목", desc: "사업 공통 항목 작성·담당자 확인 현황" },
  { suffix: "/subjects", label: "평가대상", desc: "분과별 평가 대상 현황" },
  { suffix: "/evaluators", label: "평가위원 선정현황", desc: "분과별 위원 배정 현황" },
  { suffix: "/opinions", label: "평가의견서", desc: "분과별 의견서 작성 현황" },
  { suffix: "/results", label: "집계 결과", desc: "분과별 집계·검토 현황" },
] as const;

// 경로 접미사 → 탭 이름
export const PROJECT_TAB_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_TABS.map((t) => [t.suffix, t.label]),
);
