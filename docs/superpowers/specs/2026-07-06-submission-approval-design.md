# 제출·승인/반려 워크플로 설계

**목표:** 위원 평가에 "제출" 상태와 담당 간사의 "승인/반려"를 도입한다. 반려되면 위원이 기존 점수를 유지한 채 수정 후 재제출한다. 최종 집계(점수·순위)는 **승인된 평가만** 반영한다.

## 배경 / 현재 상태

- 현재 (위원 × 대상)의 상태는 **점수 채움 수로만** 계산된다(`lib/progress.ts`의 `cellOf`): `none`(미입력)/`partial`(입력중)/`done`(전 항목 입력=입력완료). **제출·승인 개념이 없다.**
- 평가위원 화면의 "제출" 버튼(`saveScores` intent=`submit`)은 점수만 저장하고 다음 대상으로 이동할 뿐, 별도 상태를 남기지 않는다.
- `Score(evaluatorId, subjectId, criterionId)`, `Opinion(evaluatorId, subjectId)`. 집계(`results`, `RankingTable`, `getSessionInsights`, CSV)는 **입력된 모든 점수**를 사용한다.

## 결정 사항 (확정)

- 반려 후: **수정 후 재제출**(기존 점수 유지, 편집 재개). 점수 초기화 아님.
- 승인/반려 권한: **담당 간사(+마스터)**. (위원장·평가위원 불가)
- 집계 반영: **승인된 평가만** 최종 점수·순위·환산·등급·CSV에 반영. 미제출·제출대기·반려는 제외.
- 간사 검토 UI: **실시간 모니터링 페이지 안**에 "제출 검토" 표 추가.
- 기존 데이터: **전 항목 입력 완료된 (위원,대상)은 승인(APPROVED)으로 백필**(현재 결과 유지). 부분 입력은 상태 없음(DRAFT 취급).

## 상태 모델

새 모델 `Submission` — (위원 × 대상)당 1건.

```prisma
enum SubmissionStatus { DRAFT SUBMITTED APPROVED REJECTED }

model Submission {
  id           String           @id @default(cuid())
  sessionId    String
  session      EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  evaluatorId  String
  subjectId    String
  status       SubmissionStatus @default(DRAFT)
  submittedAt  DateTime?
  decidedAt    DateTime?
  decidedById  String?
  updatedAt    DateTime         @updatedAt
  @@unique([evaluatorId, subjectId])
  @@index([sessionId])
}
```

**생명주기:**
```
(없음/DRAFT)  ── 점수 채움 ──▶ 미입력 / 입력중 / 입력완료(다 채웠으나 미제출)
   │  위원 '제출'(전 항목 필수)
   ▼
SUBMITTED(제출완료) ── 간사 '승인' ──▶ APPROVED(승인, 최종·잠금)
   │  간사 '반려'
   ▼
REJECTED(반려) ── 편집 재개(점수 유지) ── 위원 '재제출' ──▶ SUBMITTED …
```

- **편집 가능 여부**: `DRAFT`/`REJECTED`/없음 = 편집 가능. `SUBMITTED`/`APPROVED` = 잠금(위원 read-only).
- `APPROVED`는 최종(잠금). 승인 취소/재오픈은 **이번 범위 밖**(추후 필요 시 별도).
- 순수 헬퍼 `lib/submission.ts`: `canEvaluatorEdit(status)`, `derivedCellStatus(status, filled, total)` 등 — 단위 테스트 대상.

## 위원 흐름 (evaluate)

- `saveScores`(intent=`submit`): 전 항목 유효 입력 확인 후 점수 upsert + `Submission` 상태 `SUBMITTED`(submittedAt 기록). 재제출 시에도 동일.
- **잠금 가드**: `autoSaveScore`·`saveScores`는 현재 상태가 `SUBMITTED`/`APPROVED`면 저장 거부(`error: 'locked'`). `REJECTED`/`DRAFT`/없음이면 허용.
- `getSheetData`: 현재 (위원,대상)의 `status` 포함 반환.
- **ScoreForm UI**:
  - `SUBMITTED`: 입력 read-only, 배너 "제출됨 · 간사 승인 대기", 제출/임시저장 숨김.
  - `APPROVED`: read-only, 배너 "승인 완료".
  - `REJECTED`: 편집 가능, 배너 "반려됨 · 수정 후 재제출", 제출 버튼 라벨 "재제출".
  - 없음/`DRAFT`: 현재와 동일(입력·임시저장·제출).
- 위원 홈(`getHomeData`) 대상 상태 배지에 제출완료/승인/반려 반영.

## 간사 승인/반려 UI

- **위치:** 분과 상세 > 실시간 모니터링(`/admin/sessions/[id]/progress`) 하단에 "제출 검토" 표 추가(신규 컴포넌트 `ReviewTable`, client).
- **표(사진 양식):** `대상 | 위원 | 점수(총점) | 현황 | 승인·반려`. 행 = (대상 × 배정 위원). 현황 = 작성중/입력완료/제출완료/승인/반려.
- **버튼:** `제출완료` 행에서만 "승인/반려" 버튼 활성(그 외 비활성). 클릭 시 **확인 모달**이 열리고, 모달에서 **[승인] 또는 [반려] 중 하나를 선택해 확정**한다(사유 입력 없음). 새 창 아님(모달).
- **서버 액션**(`app/admin/sessions/actions.ts`):
  - `approveEvaluation(sessionId, subjectId, evaluatorId)`: `assertSessionAccess`(담당 간사·마스터), 상태가 `SUBMITTED`일 때만 `APPROVED`. `revalidatePath` progress·results.
  - `rejectEvaluation(sessionId, subjectId, evaluatorId)`: 동일 권한, `SUBMITTED`일 때만 `REJECTED`. revalidate.
- 데이터: `getSessionProgress`(또는 신규 함수)가 (위원,대상) submission 맵과 총점을 함께 반환.

## 집계 변경 (승인분만)

`computeFinalScores`에 넣기 전, 점수를 **APPROVED인 (위원,대상) 쌍으로 필터**한다.

- `app/admin/sessions/[id]/results/page.tsx`: 승인 집합 조회 → `computeFinalScores`/`rankSubjects`/RankingTable에 전달할 점수를 승인분만. "완료 위원" = 승인 위원.
- `RankingTable`: 최종/환산/등급/순위는 승인분만. 위원별 상세 셀은 승인분만 표시(미승인은 비표시).
- `getSessionInsights`(잠정순위·편차): 승인분만.
- `/api/sessions/[id]/results.csv`: 승인분만.
- **변경 없음:** 위원별 평가표 인쇄(`/sheet`)·위원장 총괄표(`chair`)는 개별 원점수를 그대로 표시(검토는 관리자 측 개념).
- **진행률 정의 유지:** 모니터링 상단 요약의 전체 진행률(pct)·완료 위원 수는 **기존 정의(점수 입력 기준) 그대로**. 제출/승인 상태는 셀 배지와 "제출 검토" 표에만 추가하며, pct·집계를 재정의하지 않는다.

## 데이터 마이그레이션

1. 수기 SQL 마이그레이션: `SubmissionStatus` enum + `Submission` 테이블 생성.
2. 백필(SQL 또는 tsx 스크립트): 각 분과에서 배정 위원×대상별 입력 점수 수가 `criteria` 수와 같으면(전 항목 입력) `Submission`을 `APPROVED`로 삽입(submittedAt·decidedAt = 백필 시각). 부분/미입력은 행 없음. → 기존 결과 유지.

## 테스트

- **unit(`lib/submission.ts`)**: 상태별 편집 가능 여부, 파생 셀 상태, 집계 필터 헬퍼.
- **component**: `ReviewTable` — 상태별 승인/반려 버튼 활성·비활성, 확인 모달에서 승인/반려 선택 시 해당 액션 호출.
- **e2e(안전 픽스처)**: 위원 제출 → 잠금(수정 불가) → 간사 반려 → 위원 재편집·재제출 → 간사 승인 → 집계에 반영. 권한: 담당 간사만 승인/반려, 타 분과 불가.

## 파일 (신규/변경)

- `prisma/schema.prisma` + `prisma/migrations/*_submission/` + 백필 스크립트
- `lib/submission.ts`(신규, 순수 헬퍼) + `lib/submission.test.ts`
- `app/evaluate/actions.ts`(제출→상태, 잠금 가드), `lib/evaluate-data.ts`(상태 노출), `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx`(잠금/반려 UI)
- `lib/progress.ts`(submission 인지 셀 상태 + 검토 데이터) 또는 신규 함수
- `app/admin/sessions/[id]/progress/page.tsx` + `components/ReviewTable.tsx`(신규) + `app/admin/sessions/actions.ts`(approve/reject)
- `app/admin/sessions/[id]/results/page.tsx`, `components/RankingTable.tsx`, `lib/progress.ts`(insights), `app/api/sessions/[id]/results.csv/route.ts` — 승인 필터

## 미해결/비범위(YAGNI)

- 승인 취소·승인본 재오픈: 범위 밖(필요 시 후속).
- 반려 사유: **없음**(승인/반려는 모달에서 선택 확정만). 사유 기록이 필요하면 후속.
- 위원별 개별 항목 코멘트(사진의 3분할 의견 등)는 별개 기능.
