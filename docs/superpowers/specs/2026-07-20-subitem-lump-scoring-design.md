# 세부항목 통합 배점(퉁 채점) 설계

2026-07-20 · 승인됨(대화에서 설계 승인)

## 배경

실제 평가표에는 세부항목 하나(예: 30점)에 평가지표가 여러 개 딸려 있어도 **점수는 세부항목 단위로 한 번만** 매기는 양식이 있다. 현재 시스템은 평가지표마다 배점·채점을 강제하므로 이 양식을 담을 수 없다. 또한 편집기 UX가 세부항목 추가 시 첫 평가지표 입력을 강제하고, 평가지표는 하나씩만 추가할 수 있다.

## 결정 사항

- **채점 단위는 세부항목마다 선택**: 지표별 배점(기존) 또는 세부항목 통합 배점(신규) — 두 방식이 한 평가표 안에 공존한다.
- **세부항목 추가는 이름만** 입력한다(첫 평가지표 세트 입력 제거).
- **평가지표 추가 모달에서 방식을 정한다**: 지표 여러 줄을 한 번에 입력할 수 있고, ① 통합 배점(지표명만 N줄 + 통합 배점 1칸) ② 지표별 배점(줄마다 이름+배점) 중 택1. 이미 방식이 정해진 세부항목이면 선택지 없이 그 방식으로만 추가된다. 줄 1개만 넣으면 하나씩 추가하는 기존 흐름과 같다.
- 방식 전환 UI는 v1 범위 밖 — 지표를 전부 삭제하면 다시 선택할 수 있다.

## 데이터 모델 (접근 A — 정식 모델)

```prisma
model CriterionSubitem {
  // ...기존 필드...
  maxScore Float?   // null = 지표별 모드(기존), 값 있음 = 통합 배점 모드
}

model Score {
  criterionId String?   // 지표별 모드 점수 (기존 필수 → nullable)
  subitemId   String?   // 통합 모드 점수 (신규)
  // criterionId·subitemId 중 정확히 하나만 채워진다(앱 레벨 보장)
}
```

- 마이그레이션은 **추가만**(ADD COLUMN, DROP NOT NULL) — 공유 Neon DB에서 기존 데이터·구 코드와 호환. 기존 세부항목 20건은 자동으로 지표별 모드(maxScore=null).
- Score 유니크 제약: 기존 (evaluator, subject, criterion) 유지 + (evaluator, subject, subitem) 부분 유니크 추가.

## 채점 단위(unit) 추상화

집계·진행률·인쇄·엑셀의 공용 개념. `lib/criteria-units.ts`(신규):

```ts
type ScoringUnit = { unitId: string; label: string; maxScore: number; groupName: string; subitemName: string; indicators: string[] }
// 지표별 세부항목 → 지표 각각이 unit(unitId = criterion.id)
// 통합 세부항목   → 세부항목이 unit 1개(unitId = subitem.id, indicators = 지표명들)
// Score 행 → unitId 매핑: score.criterionId ?? score.subitemId
```

`computeWeightedScore`/`computeFinalScores`는 id 문자열 기준으로 동작하므로 호출부가 units로 입력을 구성하면 수정 불요(가중치는 1 고정).

## 화면별 변경

- **편집기(CriteriaEditor)**: 세부항목 추가=이름만(`addSubitem` 액션 신설, `addSubitemWithCriterion` 제거). 평가지표 추가 모달=여러 줄 입력(+줄 추가)과 방식 선택(신규 모드일 때만). 통합 세부항목은 배점 열을 rowSpan으로 병합해 통합 배점 1개 표시. 세부항목 편집에서 통합 배점 수정 가능. 합계·목표배점 검증(`lib/criteria`)은 unit 배점 합으로 계산.
- **채점 화면(evaluate)**: 통합 세부항목=지표 글머리표 + 세부항목당 점수 입력 1칸(0~통합배점). 지표별=기존 그대로. 저장 액션은 unit 종류에 따라 criterionId/subitemId로 기록.
- **집계·진행률**: 완료 판정(전 항목 입력)·분과 집계·과제 집계·위원별 점수 모달 모두 unit 목록 기준으로 치환.
- **인쇄(평가표·기준표·대상별 점수)·엑셀 내보내기**: 통합 세부항목은 지표들을 묶어 표시하고 배점·점수는 세부항목 행에 1개.
- **K-PASS 임포트**: v1은 지표별 모드로만 생성(통합 임포트는 후속 과제).

## 안전·마이그레이션

- 마이그레이션은 멱등(IF NOT EXISTS / DO $$ 예외 무시) + 추가 전용. 배포 전 구 코드가 새 컬럼을 몰라도 동작.
- 점수가 이미 입력된 세부항목의 방식 변경·지표 삭제는 기존 삭제 가드 규칙을 따른다.
- 시드 계정·기존 데모 데이터 불변.

## 검증

- 단위 테스트: units 빌더(두 모드 혼합), 합계 검증, 집계 동등성(지표별만 있을 때 기존 결과와 동일).
- 라이브: 통합 세부항목 생성(지표 3개+30점) → 평가위원 채점(1칸 입력) → 분과·과제 집계 반영 → 인쇄·엑셀 확인 → 테스트 데이터 정리.
