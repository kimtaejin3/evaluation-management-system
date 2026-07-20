// 평가항목 편집기(CriteriaEditor)의 DTO 타입 + 낙관적 추가 리듀서.
// 'use client' 컴포넌트 파일에서 컴포넌트가 아닌 값(optReducer)을 export 하면 React Fast Refresh가
// 해당 모듈을 핫 업데이트하지 못하고 전체 새로고침으로 폴백한다(개발 중 "여러 번 새로고침"의 원인).
// → 리듀서·타입은 이 비클라이언트 모듈로 분리해 CriteriaEditor.tsx는 컴포넌트만 export 하도록 한다.

export type LeafDTO = { id: string; name: string; maxScore: number };
// maxScore: null = 지표별 배점 모드, 값 있음 = 세부항목 통합 배점(퉁 채점)
export type SubitemDTO = { id: string; name: string; maxScore: number | null; criteria: LeafDTO[] };
export type GroupDTO = { id: string; name: string; maxScore: number; subitems: SubitemDTO[] };

// 추가(그룹·세부항목·평가지표 일괄) 낙관적 업데이트 — 임시 id로 즉시 삽입, 서버 확정 후 revalidate로 교체
export type OptAction =
  | { kind: "group"; id: string; name: string; maxScore: number }
  | { kind: "subitem"; id: string; groupId: string; name: string }
  | {
      kind: "criteria-batch";
      subitemId: string;
      items: { id: string; name: string; maxScore: number }[];
      // 통합 배점 모드로 추가할 때 세부항목에 반영할 통합 배점(지표별 모드는 null)
      lumpScore: number | null;
    };

export function optReducer(state: GroupDTO[], a: OptAction): GroupDTO[] {
  if (a.kind === "group") {
    return [...state, { id: a.id, name: a.name, maxScore: a.maxScore, subitems: [] }];
  }
  if (a.kind === "subitem") {
    return state.map((g) =>
      g.id === a.groupId
        ? { ...g, subitems: [...g.subitems, { id: a.id, name: a.name, maxScore: null, criteria: [] }] }
        : g,
    );
  }
  return state.map((g) => ({
    ...g,
    subitems: g.subitems.map((s) =>
      s.id === a.subitemId
        ? {
            ...s,
            maxScore: a.lumpScore ?? s.maxScore,
            criteria: [...s.criteria, ...a.items],
          }
        : s,
    ),
  }));
}
