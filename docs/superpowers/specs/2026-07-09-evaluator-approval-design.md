# 분과 위원 승인 워크플로 + 관리자 검토완료 — 설계

**작성일:** 2026-07-09

## 배경 / 목표

현재 평가위원은 전역 `/admin/evaluators`에서 생성되고, 분과에서 `assignEvaluator`로 가져와 `Assignment`로 연결된다(승인 개념 없음). 운영 모델을 바꾼다:

- **간사**가 담당 분과에 위원을 등록(전역 풀 선택 또는 신규 생성).
- **관리자(MASTER)** 가 각 위원을 승인/비승인(또는 전체 승인)한다.
- 관리자가 분과 결과를 검토하고 **"검토 완료"** 를 누르면 그 분과는 `완료(CLOSED)` 상태가 된다.
- 관리자는 간사가 세팅·진행한 심사를 **모니터링하고 허가**하는 역할.

## 결정 사항 (확정)

1. 위원 등록: **전역 풀 선택 유지 + 간사도 신규 생성** (두 경로 병행).
2. 승인 전(PENDING) 위원: **평가 접근 차단** (로그인해도 해당 분과 평가 진입 불가).
3. 검토 완료 버튼: **집계 결과 상단, 사전 조건 없음** → 분과 `CLOSED`.
4. 전역 "평가위원 관리" 메뉴: **관리자 전용 조회로 유지**(간사에게 숨김), 전역 풀 공급원.

## A. 데이터 모델

`prisma/schema.prisma`:

```prisma
enum AssignmentStatus {
  PENDING
  APPROVED
  REJECTED
}

model Assignment {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      AssignmentStatus  @default(PENDING)
  createdById String?           // 등록한 주체(간사/관리자)
  createdAt   DateTime          @default(now())
  decidedAt   DateTime?         // 관리자가 승인/반려한 시각

  @@unique([sessionId, userId])
}
```

- 마이그레이션: 손수 작성 SQL(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) + `npx prisma migrate deploy`.
- **백필**: 기존 모든 `Assignment.status = APPROVED`, `createdAt`은 현재값 유지. (이미 활동 중인 배정이므로.)

## B. 순수 헬퍼 — `lib/assignment.ts`

DB 비의존 순수 함수(단위 테스트 대상):

```ts
export type AssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
// 위원이 평가에 참여 가능한 상태(활성)인가
export function isAssignmentActive(status: AssignmentStatus): boolean { return status === 'APPROVED' }
export function assignmentStatusLabel(status: AssignmentStatus): string // 대기/승인/반려
// 등록 주체 역할에 따른 초기 상태: 관리자=APPROVED, 그 외=PENDING
export function initialAssignmentStatus(actorRole: 'MASTER' | 'SECRETARY'): AssignmentStatus
```

## C. 간사의 위원 등록 (두 경로)

"평가 위원 섭외 현황"(`/admin/sessions/[id]/evaluators`)에서:

1. **전역 풀 선택** — 기존 `assignEvaluator` 유지하되, 생성되는 `Assignment.status`를 `initialAssignmentStatus(actorRole)`로 설정(간사→PENDING, 관리자→APPROVED), `createdById=actor`.
2. **신규 생성** — 새 액션 `createEvaluatorForSession(sessionId, formData{name, phone})`: `User(role=EVALUATOR, username·tempPassword 자동)` 생성(`createEvaluator` 로직 재사용) + `Assignment(PENDING, createdById=actor)`.

권한: `assertSessionAccess(sessionId)`(관리자 + 담당 간사). 마감(CLOSED) 분과는 등록 불가.

## D. 관리자 승인 UI + 액션

같은 페이지에 관리자 전용 승인 컨트롤:

- 행별 상태 배지(대기/승인/반려) + **승인 / 비승인** 버튼, 목록 상단 **전체 승인** 버튼.
- 서버 액션(관리자 전용 가드 `assertMaster` — 아래):
  - `approveAssignment(sessionId, userId)` → `status=APPROVED, decidedAt=now`.
  - `rejectAssignment(sessionId, userId)` → `status=REJECTED, decidedAt=now`; 그 위원이 위원장이면 `chairId` 해제.
  - `approveAllAssignments(sessionId)` → 해당 분과 `PENDING` 전부 APPROVED.
- 간사는 상태를 **읽기만**(승인 버튼 미표시), 위원 추가·제거만 가능.

권한 가드: `lib/authz.ts`에 `assertMaster()` 추가(현재 토큰 role !== MASTER면 notFound). 승인 계열 액션에서 사용.

## E. 평가 접근 차단 (PENDING·REJECTED)

"위원 배정은 APPROVED일 때만 유효" 규칙을 위원 대면 지점에 일괄 적용:

- `lib/login-rules.ts` — 로그인 가능 판정의 `activeAssignedSessionCount`를 **APPROVED 배정 수**로 계산.
- `app/api/evaluate/home`(평가위원 홈 목록) — APPROVED 배정 분과만 노출.
- `lib/evaluate-data.ts:153` — 위원 대면 조회 시 자기 배정이 APPROVED인지 확인, 아니면 접근 거부.
- `app/evaluate/actions.ts:54,101` — `assigned` 검사에 `status===APPROVED` 추가(미승인 시 저장/제출 거부).
- 미승인 위원 화면: "승인 대기 중입니다" 안내.

주의: 모니터링/집계는 이미 제출·승인 기준으로 동작하므로 추가 변경 최소. 위원장 지정은 APPROVED 위원만.

## F. 관리자 검토 완료

- `app/admin/sessions/[id]/results` 상단에 **관리자 전용** "검토 완료" 버튼(간사에게 미표시).
- 액션 `completeReview(sessionId)`(`assertMaster`) → `session.status=CLOSED`. 사전 조건 없음. 이미 완료면 무시.
- 완료 상태의 점수 잠금은 기존 로직 재사용.

## G. 전역 "평가위원 관리" 메뉴 — 관리자 전용

- `components/AdminSidebar.tsx`: `/admin/evaluators` 링크를 **마스터에게만** 표시(간사 사이드바에서 제거).
- 페이지 자체도 마스터 전용 가드. 마스터는 전역 위원 생성/조회 계속 가능(풀 공급원).

## 테스트

- **단위(`lib/assignment.test.ts`)**: `isAssignmentActive`, `assignmentStatusLabel`, `initialAssignmentStatus`.
- **단위**: 로그인 규칙이 APPROVED만 세는지(`lib/login-rules` 관련 테스트가 있으면 확장).
- **e2e(`e2e/evaluator-approval.spec.ts`)**: 간사 로그인 → 위원 신규 등록(PENDING) → 위원 로그인 시 접근 차단 → 관리자 승인 → 위원 접근 가능. 관리자 검토완료 → 분과 완료. 반려 → 재차단.
  - 기존 e2e 안전 규칙 준수: 고유 접두사(`E2E-APPR ` / `e2eappr_`), `afterAll` 접두사 기준 정리, 시드 계정(admin/gansa) 불변.

## 영향 파일 요약

- 스키마·마이그레이션·백필 스크립트
- `lib/assignment.ts`(+test), `lib/authz.ts`(assertMaster), `lib/login-rules.ts`, `lib/evaluate-data.ts`
- `app/admin/sessions/actions.ts`(assignEvaluator 상태·createEvaluatorForSession·approve/reject/approveAll·completeReview)
- `app/admin/sessions/[id]/evaluators/page.tsx`(신규 생성 폼·상태 배지·승인 컨트롤)
- `app/admin/sessions/[id]/results/page.tsx`(검토 완료 버튼) + 클라 버튼 컴포넌트
- `app/api/evaluate/home`, `app/evaluate/actions.ts`
- `components/AdminSidebar.tsx`(전역 메뉴 마스터 전용)
