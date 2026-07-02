# 평가지 3단계 구조(평가항목 → 세부항목 → 평가지표) 설계

**작성일:** 2026-07-02
**출처:** 선정평가 평가지 양식 사진 + 손글씨 요구사항

## 목표

평가 항목 구조를 현재의 2단계(`section` → `Criterion`)에서 **3단계(평가항목 → 세부항목 → 평가지표)**로 대체한다. 실제 채점은 리프인 **평가지표**에서 이루어지며, 평가위원 입력 시 **배점 초과 입력을 방지**한다. 기존 세션 데이터(입력된 점수 포함)는 자동 이관한다. 정성(등급) 채점은 제거하고 **숫자 배점 전용**으로 단순화한다.

## 배경 / 현재 구조

- `Criterion`: `sessionId, section?, name, description?, type(QUANTITATIVE|QUALITATIVE), maxScore, weight, order, gradeOptions?` — 현재 채점 리프.
- `Score.criterionId` → `Criterion` (unique `[evaluatorId, subjectId, criterionId]`).
- 집계·가중치·랭킹(`lib/scoring.ts`)과 대부분의 조회는 **리프 id**만 사용 → 리프를 유지하면 이 로직들은 불변.

## 확정된 결정 (사용자)

1. 배점은 **평가지표 행에만** 존재. 세부항목·평가항목엔 별도 채점 배점 없음.
2. 합계 검증은 **가벼운 경고 수준**(평가항목 목표배점 vs 하위 평가지표 배점 합).
3. "평가 구분 3단계" = 평가항목 3개(사업계획·추진역량·기대효과). 사진 UI를 차용.
4. 기존 데이터 **자동 이관**.
5. **숫자 배점 전용**(정성/등급 제거).
6. **수동 구성(관리자 authoring) 중심**. K-PASS 임포트는 동작만 유지(3단계 매핑 UI 재설계는 범위 외).

## 데이터 모델 (접근법 A: 리프 유지 + 부모 2레벨 추가)

```prisma
model CriterionGroup {        // 평가항목 (예: 사업계획)
  id        String   @id @default(cuid())
  sessionId String
  session   EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name      String
  maxScore  Float    @default(0)   // 목표 배점(예: 50) — 합계 경고용
  order     Int      @default(0)
  subitems  CriterionSubitem[]
}

model CriterionSubitem {       // 세부항목 (예: 정책부합성)
  id       String @id @default(cuid())
  groupId  String
  group    CriterionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name     String
  order    Int    @default(0)
  criteria Criterion[]
}

model Criterion {              // 평가지표 (리프 — 기존 모델 수정)
  id         String @id @default(cuid())
  sessionId  String                                   // 유지(세션 단위 조회 편의)
  session    EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  subitemId  String                                   // 추가
  subitem    CriterionSubitem @relation(fields: [subitemId], references: [id], onDelete: Cascade)
  name       String                                   // 평가지표 설명 텍스트
  maxScore   Float                                    // 배점
  weight     Float  @default(1)                       // 유지(scoring.ts 호환), UI 비노출
  order      Int    @default(0)
  scores     Score[]
  // 제거: section, description, type, gradeOptions
}
```

- **제거:** `Criterion.section / description / type / gradeOptions`, `enum CriterionType`.
- **`Score` 모델:** 변경 없음. `criterionId`는 계속 리프(평가지표)를 가리킴. `grade` 컬럼은 (숫자 전용이라) 이후 항상 null이지만 파괴적 변경을 피하기 위해 컬럼은 유지하고 사용만 중단.
- **`EvaluationSession`:** `criteria Criterion[]` 유지 + `criterionGroups CriterionGroup[]` 관계 추가.
- **`lib/scoring.ts`(가중치·합산·랭킹):** 변경 없음. `weight` 기본 1이므로 최종점수 = 배점 합.

## 마이그레이션 (기존 데이터 자동 이관, 1회)

파괴적 컬럼 변경이 있으므로 **3단계**로 진행한다(기존 프로젝트의 hand-authored SQL + tsx 백필 패턴 준수).

1. **migration A (비파괴):** `CriterionGroup`, `CriterionSubitem` 테이블 생성. `Criterion.subitemId`를 **nullable**로 추가.
2. **백필 스크립트(tsx, 1회 실행):** 세션별로
   - 서로 다른 `section`을 최초 등장 순서로 `CriterionGroup` 생성(`name = section ?? '기타'`, `order` 순차).
   - 기존 `Criterion` 각각에 대해:
     - `CriterionSubitem` 1개 생성(`name = criterion.name`, `groupId` = 해당 section 그룹, `order` 승계).
     - `criterion.subitemId` = 위 subitem, `criterion.name = criterion.description ?? criterion.name`(평가지표 텍스트로 승격), `maxScore/weight/order` 보존.
   - `group.maxScore` = 해당 그룹 하위 `Criterion.maxScore` 합.
   - **`Score`는 손대지 않음**(리프 id 불변 → 입력 점수 보존).
3. **migration B (파괴):** `Criterion.subitemId` NOT NULL 전환, `section/description/type/gradeOptions` 컬럼 및 `CriterionType` enum 제거.

> 개발 단계 · Neon 공유 DB. `npx prisma migrate deploy`로 적용, `prisma generate`.

## 관리자 authoring UI (사진 차용)

**경로:** `app/admin/sessions/[id]/criteria/page.tsx` 재작성 + 신규 클라이언트 트리 편집기 컴포넌트.

- **표 레이아웃:** `평가항목 | [세부항목 추가] | 세부항목 | [평가지표 추가] | 평가지표 | 배점 | 삭제`
- **버튼:** `[평가항목 추가]`(상단) · `[세부항목 추가]`(평가항목별) · `[평가지표 추가]`(세부항목별) · `[삭제]`(행별: 평가항목/세부항목/평가지표).
- **인라인 편집:** 평가항목명·목표배점, 세부항목명, 평가지표 텍스트·배점을 인라인 입력 후 저장.
- **합계 경고(가벼운 체크):** 각 평가항목 헤더에 `하위 평가지표 배점 합`을 표시하고, 목표배점과 다르면 경고 배지(예: `합계 45 / 목표 50 ⚠`). 저장은 막지 않음.
- **서버 액션(신규, `app/admin/sessions/actions.ts`):** `addGroup / updateGroup / deleteGroup`, `addSubitem / updateSubitem / deleteSubitem`, `addCriterion(=평가지표) / updateCriterion / deleteCriterion`. 모두 `assertSessionAccess`(sessionId는 상위 관계로 유도). 각 삭제는 하위·`Score` cascade.
- **제거:** 기존 `renameSection`, `CriterionForm`의 section/type/gradeOptions/등급 입력.

## 평가위원 입력 (3단계 렌더 + 배점 상한)

**파일:** `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx`, `app/evaluate/actions.ts`, `lib/evaluate-data.ts`.

- **뷰 구성:** 리프 조회 시 `subitem → group` include. `CriterionView`에 `section` 대신 `groupName / subitemName` 부여. 한 화면에 `평가항목 → 세부항목 → 평가지표` 중첩 렌더(현행 한 화면·대상별 이동 유지).
- **정성 분기 제거:** 등급 `<select>`/gradeOptions 경로 삭제. 전부 `<input type="number">`.
- **배점 상한 검증:**
  - 클라이언트: 입력값 `0 ~ maxScore`로 클램프, 초과·음수면 시각 경고 + 제출 버튼 비활성.
  - 서버: `autoSaveScore` / `saveScores`에서 `isValidScoreValue(value, criterion.maxScore)`로 거부(초과 저장 차단).
- 0점 입력은 허용(기존 정책 유지).

## 집계 · 결과 · 임포트

- **점수 계산식 불변**(`lib/scoring.ts`). 표시 그룹핑만 `section` → `평가항목/세부항목`으로 교체:
  - `app/admin/sessions/[id]/results/page.tsx`, `app/admin/sessions/[id]/breakdown/page.tsx`, `lib/progress.ts`(insights/progress), `app/api/sessions/[id]/results.csv/route.ts`.
- **K-PASS 임포트(동작 유지, 재설계 없음):** `buildCriteria`(pure)는 그대로 두되 `commitKpassImport`를 **얇은 어댑터**로 수정 — `section`별 `CriterionGroup` 생성 → 행마다 `CriterionSubitem`(name) + `Criterion`(leaf, `maxScore`) 생성. `type/gradeOptions`(등급열)는 무시(숫자 전용). 임포트 모달 UI는 유지(등급 매핑은 무시됨 — 허용된 기술부채).

## 테스트

- `lib/scoring.test.ts`: 불변(그대로 통과).
- 신규 `lib/criteria.ts` 순수 헬퍼: `groupTotal(criteria)` 및 목표배점 불일치 판정 → 단위 테스트.
- 배점 상한: `isValidScoreValue`(기존) 테스트 유지 + 서버 액션 거부는 `scripts/core-e2e.ts`에서 재현.
- `scripts/core-e2e.ts` / `scripts/demo-seed.ts` / `scripts/e2e-check.ts`: 3단계(그룹·세부항목·평가지표) 생성으로 갱신.
- `lib/kpass-import.test.ts`: `buildCriteria` 시그니처 불변이므로 유지(임포트 커밋 어댑터는 통합 경로에서 확인).
- 실행 환경: Node 22(`export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`), `npm test` / `npm run build` / `npm run test:core`.

## 범위 외 (YAGNI)

- 정성(등급) 채점 및 K-PASS 등급표/`gradeOptions`.
- K-PASS 임포트의 3단계 전용 매핑 UI 재설계(후속).
- 평가항목 배점 합계 **강제** 일치(경고까지만).
- 평가위원 화면의 대상 간 비교 컬럼 등 기존 부가기능은 리프 기준으로 그대로 동작.

## 영향 파일 요약

- 스키마/마이그레이션: `prisma/schema.prisma`, `prisma/migrations/*`(신규 2개) + 백필 tsx 스크립트.
- 관리: `app/admin/sessions/actions.ts`, `app/admin/sessions/[id]/criteria/page.tsx`, 신규 트리 편집기 컴포넌트, `components/CriterionForm.tsx`(축소/대체), `components/Add·EditCriterionButton.tsx`.
- 평가: `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx`, `app/evaluate/actions.ts`, `lib/evaluate-data.ts`.
- 집계: `results/page.tsx`, `breakdown/page.tsx`, `lib/progress.ts`, `results.csv/route.ts`.
- 임포트: `app/admin/sessions/actions.ts`(commitKpassImport 어댑터).
- 테스트/시드: `lib/criteria.ts`(+test), `scripts/core-e2e.ts`, `scripts/demo-seed.ts`, `scripts/e2e-check.ts`.
