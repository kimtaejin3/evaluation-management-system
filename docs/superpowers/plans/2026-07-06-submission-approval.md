# 제출·승인/반려 워크플로 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위원 평가에 제출 상태와 담당 간사의 승인/반려를 도입하고, 반려 시 위원이 점수를 유지한 채 수정·재제출하며, 최종 집계는 승인된 평가만 반영한다.

**Architecture:** (위원×대상)별 `Submission` 레코드로 상태(DRAFT/SUBMITTED/APPROVED/REJECTED)를 저장. 순수 상태 헬퍼(`lib/submission.ts`)를 evaluate 제출·잠금, 모니터링 셀 표시, 집계 필터가 공유. 간사 검토 UI는 실시간 모니터링 페이지 내 표.

**Tech Stack:** Next.js 16 App Router(webpack), Prisma/Postgres(Neon), Vitest(unit=node, components=jsdom), Playwright(e2e).

## Global Constraints

- 빌드·테스트는 **Node 22**에서: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` 후 실행. (기본 셸 Node 21은 vitest가 깨짐)
- 마이그레이션은 **수기 SQL + `npx prisma migrate deploy`**(shadow DB 회피). 추가(additive) 우선.
- 승인/반려 권한 = **담당 간사(+마스터)**. `assertSessionAccess`로 강제.
- 승인/반려는 **확인 모달에서 [승인]/[반려] 선택 확정만**. 반려 사유 없음.
- 반려 후 = **편집 재개(기존 점수 유지) → 재제출**.
- 집계(결과/순위/환산/등급/CSV/잠정순위·편차)는 **APPROVED인 (위원,대상)만** 반영. 위원별 평가표 인쇄·위원장 총괄표는 원점수 유지.
- e2e 픽스처는 **고유 접두어 + afterAll 접두어 정리**(공유 DB 안전). 시드 계정(admin/gansa) 삭제 금지.
- 상태 문자열(한국어): 미입력 / 입력중 / 입력완료 / 제출완료 / 승인 / 반려.

---

### Task 1: Submission 스키마 + 마이그레이션 + 백필

**Files:**
- Modify: `prisma/schema.prisma` (enum + model 추가, `EvaluationSession`에 관계 추가)
- Create: `prisma/migrations/20260706100000_submission/migration.sql`
- Create: `scripts/backfill-submission.ts`

**Interfaces:**
- Produces: 모델 `Submission { id, sessionId, evaluatorId, subjectId, status, submittedAt?, decidedAt?, decidedById?, updatedAt }`, enum `SubmissionStatus { DRAFT SUBMITTED APPROVED REJECTED }`, 유니크 `@@unique([evaluatorId, subjectId])`. Prisma client 재생성.

- [ ] **Step 1: 스키마에 enum + model 추가**

`prisma/schema.prisma`의 `enum SessionStatus { ... }` 블록 아래에 추가:
```prisma
enum SubmissionStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}
```
파일 끝(마지막 model 뒤)에 추가:
```prisma
// (위원 × 대상)별 제출/승인 상태
model Submission {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  evaluatorId String
  subjectId   String
  status      SubmissionStatus  @default(DRAFT)
  submittedAt DateTime?
  decidedAt   DateTime?
  decidedById String?
  updatedAt   DateTime          @updatedAt

  @@unique([evaluatorId, subjectId])
  @@index([sessionId])
}
```
`model EvaluationSession { ... }`의 관계 목록(`scores  Score[]` 근처)에 한 줄 추가:
```prisma
  submissions Submission[]
```

- [ ] **Step 2: 수기 SQL 마이그레이션 작성**

`prisma/migrations/20260706100000_submission/migration.sql`:
```sql
-- 제출/승인 상태 (위원 × 대상)
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "Submission" (
  "id"          TEXT NOT NULL,
  "sessionId"   TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "subjectId"   TEXT NOT NULL,
  "status"      "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "decidedAt"   TIMESTAMP(3),
  "decidedById" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Submission_evaluatorId_subjectId_key" ON "Submission"("evaluatorId", "subjectId");
CREATE INDEX "Submission_sessionId_idx" ON "Submission"("sessionId");

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_sessionId_fkey" FOREIGN KEY ("sessionId")
  REFERENCES "EvaluationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: 마이그레이션 적용 + 클라이언트 재생성**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx prisma migrate deploy && npx prisma generate
```
Expected: `Submission` 마이그레이션 적용 완료, `✔ Generated Prisma Client`.

- [ ] **Step 4: 백필 스크립트 작성**

`scripts/backfill-submission.ts` — 전 항목 입력 완료된 (위원,대상)을 APPROVED로:
```ts
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  const sessions = await prisma.evaluationSession.findMany({ select: { id: true } })
  let created = 0
  for (const { id: sessionId } of sessions) {
    const [criteria, assignments, scores] = await Promise.all([
      prisma.criterion.findMany({ where: { sessionId }, select: { id: true } }),
      prisma.assignment.findMany({ where: { sessionId }, select: { userId: true } }),
      prisma.score.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, criterionId: true } }),
    ])
    const total = criteria.length
    if (total === 0) continue
    const subjectIds = [...new Set(scores.map((s) => s.subjectId))]
    const countBy = new Map<string, number>()
    for (const s of scores) {
      const k = `${s.evaluatorId}:${s.subjectId}`
      countBy.set(k, (countBy.get(k) ?? 0) + 1)
    }
    for (const a of assignments) {
      for (const subjectId of subjectIds) {
        const filled = countBy.get(`${a.userId}:${subjectId}`) ?? 0
        if (filled < total) continue
        const existing = await prisma.submission.findUnique({
          where: { evaluatorId_subjectId: { evaluatorId: a.userId, subjectId } },
        })
        if (existing) continue
        await prisma.submission.create({
          data: {
            sessionId, evaluatorId: a.userId, subjectId,
            status: 'APPROVED', submittedAt: new Date(), decidedAt: new Date(),
          },
        })
        created++
      }
    }
  }
  console.log(`backfilled ${created} APPROVED submissions`)
  await prisma.$disconnect()
}
main()
```

- [ ] **Step 5: 백필 실행**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsx scripts/backfill-submission.ts
```
Expected: `backfilled N APPROVED submissions` (N ≥ 0). 오류 없이 종료.

- [ ] **Step 6: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20260706100000_submission scripts/backfill-submission.ts
git commit -m "feat(submission): Submission 모델·마이그레이션·백필"
```

---

### Task 2: 순수 상태 헬퍼 `lib/submission.ts` (+ 단위 테스트)

**Files:**
- Create: `lib/submission.ts`
- Test: `lib/submission.test.ts`

**Interfaces:**
- Consumes: `SubmissionStatus`(Prisma enum, `'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'` 문자열)
- Produces:
  - `type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'`
  - `canEvaluatorEdit(status: SubmissionStatus | null): boolean` — 위원 편집 가능(null/DRAFT/REJECTED=true, SUBMITTED/APPROVED=false)
  - `type CellStatus = 'none' | 'partial' | 'entered' | 'submitted' | 'approved' | 'rejected'`
  - `cellStatus(status: SubmissionStatus | null, filled: number, total: number): CellStatus`
  - `cellStatusLabel(s: CellStatus): string` — 한국어 라벨
  - `canDecide(status: SubmissionStatus | null): boolean` — 간사 승인/반려 가능(SUBMITTED만 true)

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/submission.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { canEvaluatorEdit, cellStatus, cellStatusLabel, canDecide } from './submission'

describe('canEvaluatorEdit', () => {
  it('없음/DRAFT/REJECTED는 편집 가능', () => {
    expect(canEvaluatorEdit(null)).toBe(true)
    expect(canEvaluatorEdit('DRAFT')).toBe(true)
    expect(canEvaluatorEdit('REJECTED')).toBe(true)
  })
  it('SUBMITTED/APPROVED는 잠금', () => {
    expect(canEvaluatorEdit('SUBMITTED')).toBe(false)
    expect(canEvaluatorEdit('APPROVED')).toBe(false)
  })
})

describe('cellStatus', () => {
  it('제출/승인/반려 상태를 우선 반영', () => {
    expect(cellStatus('SUBMITTED', 3, 3)).toBe('submitted')
    expect(cellStatus('APPROVED', 3, 3)).toBe('approved')
    expect(cellStatus('REJECTED', 1, 3)).toBe('rejected')
  })
  it('상태 없음/DRAFT는 입력 수로 판정', () => {
    expect(cellStatus(null, 0, 3)).toBe('none')
    expect(cellStatus(null, 2, 3)).toBe('partial')
    expect(cellStatus('DRAFT', 3, 3)).toBe('entered')
  })
  it('전 항목 수 0이면 none', () => {
    expect(cellStatus(null, 0, 0)).toBe('none')
  })
})

describe('cellStatusLabel', () => {
  it('한국어 라벨', () => {
    expect(cellStatusLabel('entered')).toBe('입력완료')
    expect(cellStatusLabel('submitted')).toBe('제출완료')
    expect(cellStatusLabel('approved')).toBe('승인')
    expect(cellStatusLabel('rejected')).toBe('반려')
  })
})

describe('canDecide', () => {
  it('SUBMITTED만 승인/반려 가능', () => {
    expect(canDecide('SUBMITTED')).toBe(true)
    expect(canDecide('APPROVED')).toBe(false)
    expect(canDecide('DRAFT')).toBe(false)
    expect(canDecide(null)).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npx vitest run lib/submission.test.ts`
Expected: FAIL — `Failed to resolve import "./submission"`.

- [ ] **Step 3: 구현**

`lib/submission.ts`:
```ts
// (위원 × 대상) 제출/승인 상태 순수 헬퍼 — prisma/next 의존 없음.
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type CellStatus = 'none' | 'partial' | 'entered' | 'submitted' | 'approved' | 'rejected'

// 위원이 점수·의견을 편집할 수 있는가(제출/승인 시 잠금)
export function canEvaluatorEdit(status: SubmissionStatus | null): boolean {
  return status == null || status === 'DRAFT' || status === 'REJECTED'
}

// 간사가 승인/반려할 수 있는가(제출완료만)
export function canDecide(status: SubmissionStatus | null): boolean {
  return status === 'SUBMITTED'
}

// 모니터링 셀 상태 — 제출/승인/반려가 있으면 우선, 없으면 입력 수로 판정
export function cellStatus(status: SubmissionStatus | null, filled: number, total: number): CellStatus {
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  if (total > 0 && filled >= total) return 'entered'
  if (filled > 0) return 'partial'
  return 'none'
}

const LABELS: Record<CellStatus, string> = {
  none: '미입력',
  partial: '입력중',
  entered: '입력완료',
  submitted: '제출완료',
  approved: '승인',
  rejected: '반려',
}
export function cellStatusLabel(s: CellStatus): string {
  return LABELS[s]
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npx vitest run lib/submission.test.ts`
Expected: PASS (모든 케이스).

- [ ] **Step 5: 커밋**

```bash
git add lib/submission.ts lib/submission.test.ts
git commit -m "feat(submission): 상태 순수 헬퍼 + 단위 테스트"
```

---

### Task 3: 위원 제출 → 상태 저장 + 편집 잠금 가드

**Files:**
- Modify: `app/evaluate/actions.ts` (`autoSaveScore`, `saveScores`)

**Interfaces:**
- Consumes: `canEvaluatorEdit` from `lib/submission.ts` (Task 2)
- Produces: 제출 시 `Submission` upsert(`SUBMITTED`); 잠금 상태에서 저장 거부.

- [ ] **Step 1: `autoSaveScore`에 잠금 가드 추가**

`app/evaluate/actions.ts`의 `autoSaveScore`에서, assignment 확인 직후에 추가:
```ts
  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(sub?.status ?? null)) return { ok: false, error: 'locked' }
```
파일 상단 import 추가: `import { canEvaluatorEdit } from '@/lib/submission'`.

- [ ] **Step 2: `saveScores`에 잠금 가드 + 제출 시 상태 저장**

`saveScores`에서 assignment 확인 직후에 잠금 가드 추가(임시저장·제출 모두 차단):
```ts
  const existingSub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
    select: { status: true },
  })
  if (!canEvaluatorEdit(existingSub?.status ?? null)) {
    return { error: '이미 제출/승인되어 수정할 수 없습니다.' }
  }
```
그리고 `intent === 'submit'` 경로에서, 점수 upsert 루프와 opinion 저장이 끝난 뒤(다음 대상 redirect 직전) Submission 저장 추가:
```ts
  if (intent === 'submit') {
    await prisma.submission.upsert({
      where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
      update: { status: 'SUBMITTED', submittedAt: new Date() },
      create: { sessionId, evaluatorId: user.id, subjectId, status: 'SUBMITTED', submittedAt: new Date() },
    })
  }
```

- [ ] **Step 3: 빌드 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed"`
Expected: `✓ Compiled successfully`. (동작 검증은 Task 8 e2e)

- [ ] **Step 4: 커밋**

```bash
git add app/evaluate/actions.ts
git commit -m "feat(submission): 제출 시 상태 저장 + 위원 편집 잠금 가드"
```

---

### Task 4: 위원 화면에 상태 노출(잠금/반려 UI)

**Files:**
- Modify: `lib/evaluate-data.ts` (`SheetData`에 `submissionStatus` 추가; `getSheetData`에서 조회)
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx` (잠금/반려 배너 + 입력 disabled + 버튼 라벨)
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreSheetClient.tsx` (prop 전달)

**Interfaces:**
- Consumes: `SubmissionStatus`, `canEvaluatorEdit` from `lib/submission.ts`
- Produces: `SheetData.submissionStatus: SubmissionStatus | null`

- [ ] **Step 1: `getSheetData`에 상태 추가**

`lib/evaluate-data.ts`의 `SheetData` 인터페이스에 필드 추가:
```ts
  submissionStatus: import('./submission').SubmissionStatus | null
```
`getSheetData`의 `Promise.all([...])`에 조회 추가:
```ts
    prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } }, select: { status: true } }),
```
반환 객체에 추가: `submissionStatus: (submission?.status ?? null) as ...` — 조회 결과 변수명은 `submission`으로 구조분해.

- [ ] **Step 2: ScoreSheetClient에서 prop 전달**

`ScoreSheetClient.tsx`의 `<ScoreForm ... />`에 `submissionStatus={data.submissionStatus}` 추가. `SheetData` 타입에 이미 필드가 있어 자동 전달.

- [ ] **Step 3: ScoreForm 잠금/반려 UI**

`ScoreForm.tsx`에서:
- props 타입에 `submissionStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null` 추가.
- 상단(`import` 아래)에 `import { canEvaluatorEdit } from '@/lib/submission'`.
- 컴포넌트 본문 초반에 `const locked = !canEvaluatorEdit(submissionStatus ?? null)`.
- 점수 `<input>`에 `disabled={locked}` 추가.
- 우측 패널 버튼 영역: `locked`이면 제출/임시저장 버튼 대신 배너 표시:
  ```tsx
  {submissionStatus === 'SUBMITTED' && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-200">제출됨 · 간사 승인 대기</p>}
  {submissionStatus === 'APPROVED' && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">승인 완료</p>}
  ```
- 반려 배너(편집 가능): `submissionStatus === 'REJECTED'`이면 상단에 `<p className="... bg-rose-50 text-rose-700 ...">반려됨 · 수정 후 재제출</p>`, 제출 확인 버튼 라벨을 `제출 전 확인 →` 대신 `재제출 확인 →`로.
- `locked`이면 `제출 전 확인`/`임시 저장` 버튼 숨김.

- [ ] **Step 4: 빌드 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed"`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: 커밋**

```bash
git add lib/evaluate-data.ts app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx app/evaluate/[sessionId]/[subjectId]/ScoreSheetClient.tsx
git commit -m "feat(submission): 위원 화면 제출/승인/반려 상태 UI"
```

---

### Task 5: 모니터링 셀 상태 + 검토 데이터

**Files:**
- Modify: `lib/progress.ts` (`getSessionProgress`가 submission 인지 셀 상태 + 검토 행 제공)
- Modify: `components/MonitoringCell.tsx` (제출완료/승인/반려 표시)

**Interfaces:**
- Consumes: `cellStatus`, `cellStatusLabel`, `CellStatus`, `computeWeightedScore`
- Produces: `Cell.status: CellStatus`(기존 `state` 유지), `ProgressData.review: ReviewRow[]`
  - `ReviewRow = { subjectId: string; subjectName: string; evaluatorId: string; evaluatorName: string; status: CellStatus; total: number | null }`

- [ ] **Step 1: `getSessionProgress`에 submission 조회 + 셀 상태/검토 행**

`lib/progress.ts`:
- 상단 import: `import { cellStatus, type CellStatus, type SubmissionStatus } from './submission'`, 그리고 기존 `computeWeightedScore` 사용.
- `Promise.all`에 추가: `prisma.submission.findMany({ where: { sessionId }, select: { evaluatorId: true, subjectId: true, status: true } })`, `prisma.criterion.findMany`는 weight도 select(`{ id, name, weight }`).
- submission 맵: `const subOf = new Map<string, SubmissionStatus>(); for (const s of submissions) subOf.set(`${s.evaluatorId}:${s.subjectId}`, s.status)`.
- `Cell` 인터페이스에 `status: CellStatus` 추가. `cellOf`에서 `const status = cellStatus(subOf.get(`${evId}:${subId}`) ?? null, done, totalCriteria)` 계산해 셀에 포함(기존 `state`는 그대로 둠).
- `ProgressData`에 `review: ReviewRow[]` 추가. 행 = 모든 (대상 × 배정위원):
  ```ts
  const weights = criteria.map((c) => ({ id: c.id, weight: c.weight }))
  const scoreRows = new Map<string, { criterionId: string; value: number }[]>() // key evId:subId
  for (const s of allScoresWithValue) { ... push }  // 아래 주: value 필요 → scores select에 value 추가
  const review = []
  for (const s of subjects) for (const a of orderedAssignments) {
    const key = `${a.userId}:${s.id}`
    const st = cellStatus(subOf.get(key) ?? null, (filledCountMap.get(key) ?? 0), totalCriteria)
    const rows = scoreRows.get(key) ?? []
    const total = rows.length >= totalCriteria && totalCriteria > 0 ? computeWeightedScore(rows, weights) : null
    review.push({ subjectId: s.id, subjectName: s.name, evaluatorId: a.userId, evaluatorName: a.user.name, status: st, total })
  }
  ```
  (주: 기존 `scores` select에 `value: true` 추가, `filled` Set과 별개로 `filledCountMap`을 만들거나 기존 `done` 계산 재사용.)

- [ ] **Step 2: `MonitoringCell` 상태 표시**

`components/MonitoringCell.tsx`에서 셀 `status`(신규)에 따라 라벨/색을 표시:
- `cellStatusLabel(cell.status)` 사용, 색: none=slate, partial=amber, entered=indigo, submitted=violet, approved=emerald, rejected=rose. (기존 done/partial/none 표기를 status 기반으로 교체하되 클릭 시 항목 현황 모달은 유지)

- [ ] **Step 3: 빌드 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed"`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: 커밋**

```bash
git add lib/progress.ts components/MonitoringCell.tsx
git commit -m "feat(submission): 모니터링 셀 상태 + 검토 데이터"
```

---

### Task 6: 간사 승인/반려 — ReviewTable + 서버 액션

**Files:**
- Create: `components/ReviewTable.tsx` (client, 확인 모달 포함)
- Test: `components/ReviewTable.test.tsx`
- Modify: `app/admin/sessions/actions.ts` (`approveEvaluation`, `rejectEvaluation`)
- Modify: `app/admin/sessions/[id]/progress/page.tsx` (ReviewTable 렌더)

**Interfaces:**
- Consumes: `ProgressData.review`(Task 5), `canDecide`(Task 2)
- Produces:
  - `approveEvaluation(sessionId: string, subjectId: string, evaluatorId: string): Promise<void>`
  - `rejectEvaluation(sessionId: string, subjectId: string, evaluatorId: string): Promise<void>`
  - `<ReviewTable sessionId rows={ReviewRow[]} />`

- [ ] **Step 1: 서버 액션 추가**

`app/admin/sessions/actions.ts` 끝에:
```ts
// 담당 간사(+마스터)가 제출완료 평가를 승인
export async function approveEvaluation(sessionId: string, subjectId: string, evaluatorId: string) {
  const { user } = await assertSessionAccess(sessionId)
  const sub = await prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId, subjectId } }, select: { status: true, sessionId: true } })
  if (!sub || sub.sessionId !== sessionId || sub.status !== 'SUBMITTED') return
  await prisma.submission.update({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    data: { status: 'APPROVED', decidedAt: new Date(), decidedById: user.id },
  })
  revalidatePath(`/admin/sessions/${sessionId}/progress`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}

// 담당 간사(+마스터)가 제출완료 평가를 반려(위원 편집 재개)
export async function rejectEvaluation(sessionId: string, subjectId: string, evaluatorId: string) {
  const { user } = await assertSessionAccess(sessionId)
  const sub = await prisma.submission.findUnique({ where: { evaluatorId_subjectId: { evaluatorId, subjectId } }, select: { status: true, sessionId: true } })
  if (!sub || sub.sessionId !== sessionId || sub.status !== 'SUBMITTED') return
  await prisma.submission.update({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    data: { status: 'REJECTED', decidedAt: new Date(), decidedById: user.id },
  })
  revalidatePath(`/admin/sessions/${sessionId}/progress`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}
```
(`assertSessionAccess`는 `{ user, session }` 반환 — `app/admin/sessions/actions.ts:15` import에 이미 포함.)

- [ ] **Step 2: ReviewTable 실패 테스트 작성**

`components/ReviewTable.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/app/admin/sessions/actions', () => ({
  approveEvaluation: vi.fn(() => Promise.resolve()),
  rejectEvaluation: vi.fn(() => Promise.resolve()),
}))
import { approveEvaluation } from '@/app/admin/sessions/actions'
import ReviewTable from './ReviewTable'

const rows = [
  { subjectId: 's1', subjectName: '가나기업', evaluatorId: 'e1', evaluatorName: '김위원', status: 'submitted' as const, total: 70 },
  { subjectId: 's2', subjectName: '다라기업', evaluatorId: 'e2', evaluatorName: '이위원', status: 'partial' as const, total: null },
]

describe('ReviewTable', () => {
  it('제출완료 행만 승인/반려 버튼 활성', () => {
    render(<ReviewTable sessionId="sess1" rows={rows} />)
    const buttons = screen.getAllByRole('button', { name: '승인/반려' })
    expect(buttons[0]).toBeEnabled()   // s1 submitted
    expect(buttons[1]).toBeDisabled()  // s2 partial
  })

  it('버튼 클릭 시 모달에서 승인 선택하면 approveEvaluation 호출', async () => {
    const user = userEvent.setup()
    render(<ReviewTable sessionId="sess1" rows={rows} />)
    await user.click(screen.getAllByRole('button', { name: '승인/반려' })[0])
    await user.click(screen.getByRole('button', { name: '승인' }))
    expect(approveEvaluation).toHaveBeenCalledWith('sess1', 's1', 'e1')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npx vitest run components/ReviewTable.test.tsx`
Expected: FAIL — `Failed to resolve import "./ReviewTable"`.

- [ ] **Step 4: ReviewTable 구현**

`components/ReviewTable.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { approveEvaluation, rejectEvaluation } from '@/app/admin/sessions/actions'
import { cellStatusLabel, type CellStatus } from '@/lib/submission'

export interface ReviewRow {
  subjectId: string
  subjectName: string
  evaluatorId: string
  evaluatorName: string
  status: CellStatus
  total: number | null
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function ReviewTable({ sessionId, rows }: { sessionId: string; rows: ReviewRow[] }) {
  const [target, setTarget] = useState<ReviewRow | null>(null)
  const [busy, setBusy] = useState(false)

  const decide = async (approve: boolean) => {
    if (!target) return
    setBusy(true)
    try {
      if (approve) await approveEvaluation(sessionId, target.subjectId, target.evaluatorId)
      else await rejectEvaluation(sessionId, target.subjectId, target.evaluatorId)
      setTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">제출 검토</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 font-medium">대상</th>
              <th className="px-4 py-2 font-medium">위원</th>
              <th className="px-4 py-2 text-right font-medium">점수</th>
              <th className="px-4 py-2 font-medium">현황</th>
              <th className="px-4 py-2 text-right font-medium">승인</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.subjectId}:${r.evaluatorId}`} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 text-slate-700">{r.subjectName}</td>
                <td className="px-4 py-2 text-slate-700">{r.evaluatorName}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{r.total != null ? fmt(r.total) : '-'}</td>
                <td className="px-4 py-2 text-slate-600">{cellStatusLabel(r.status)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    disabled={r.status !== 'submitted'}
                    onClick={() => setTarget(r)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    승인/반려
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">평가가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-bold text-slate-900">{target.subjectName} · {target.evaluatorName}</h3>
            <p className="mt-1 text-sm text-slate-500">이 평가를 승인 또는 반려합니다.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">취소</button>
              <button type="button" onClick={() => decide(false)} disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">반려</button>
              <button type="button" onClick={() => decide(true)} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">승인</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npx vitest run components/ReviewTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: progress 페이지에 ReviewTable 렌더**

`app/admin/sessions/[id]/progress/page.tsx`의 `ProgressContent` 반환부, `<MonitoringGrid data={p} />` 아래에:
```tsx
      <ReviewTable sessionId={id} rows={p.review} />
```
상단 import: `import ReviewTable from '@/components/ReviewTable'`.

- [ ] **Step 7: 빌드 + 커밋**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed"`
Expected: `✓ Compiled successfully`.
```bash
git add components/ReviewTable.tsx components/ReviewTable.test.tsx app/admin/sessions/actions.ts app/admin/sessions/[id]/progress/page.tsx
git commit -m "feat(submission): 간사 승인/반려 ReviewTable + 액션"
```

---

### Task 7: 집계를 승인분만 반영

**Files:**
- Modify: `app/admin/sessions/[id]/results/page.tsx`
- Modify: `lib/progress.ts` (`getSessionInsights`)
- Modify: `app/api/sessions/[id]/results.csv/route.ts`

**Interfaces:**
- Consumes: `Submission`(status APPROVED)
- Produces: 결과/순위/CSV/잠정순위·편차가 승인분만 사용.

- [ ] **Step 1: results 페이지 — 승인 집합으로 점수 필터**

`app/admin/sessions/[id]/results/page.tsx`의 `ResultsContent` `Promise.all`에 추가:
```ts
    prisma.submission.findMany({ where: { sessionId: id, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } }),
```
조회 후 승인 집합과 필터:
```ts
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const approvedScores = scores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))
```
이후 `computeFinalScores`, `scoreVal`(RankingTable 전달) 계산을 `scores` 대신 **`approvedScores`** 로 교체. (RankingTable은 승인분만 표시)

- [ ] **Step 2: `getSessionInsights` — 승인분만**

`lib/progress.ts`의 `getSessionInsights` `Promise.all`에 승인 조회 추가 후, `scores`를 승인 집합으로 필터해서 잠정순위·편차 계산에 사용:
```ts
    prisma.submission.findMany({ where: { sessionId, status: 'APPROVED' }, select: { evaluatorId: true, subjectId: true } }),
```
```ts
  const approved = new Set(approvedSubs.map((s) => `${s.evaluatorId}:${s.subjectId}`))
  const scores = allScores.filter((s) => approved.has(`${s.evaluatorId}:${s.subjectId}`))
```

- [ ] **Step 3: CSV — 승인분만**

`app/api/sessions/[id]/results.csv/route.ts`에서 점수 조회 후 동일하게 승인 집합으로 필터한 점수로 집계.

- [ ] **Step 4: 빌드 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed"`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: 커밋**

```bash
git add app/admin/sessions/[id]/results/page.tsx lib/progress.ts app/api/sessions/[id]/results.csv/route.ts
git commit -m "feat(submission): 집계를 승인분만 반영"
```

---

### Task 8: e2e — 제출·잠금·반려·재제출·승인·집계

**Files:**
- Create: `e2e/submission-approval.spec.ts`
- Modify: `e2e/helpers.ts` (필요 시 헬퍼 재사용; 접두어 상수 그대로)

**Interfaces:**
- Consumes: `loginAs`, `createEvaluator`, `cleanupT1`, 접두어 상수 from `e2e/helpers.ts`

- [ ] **Step 1: 스펙 작성**

`e2e/submission-approval.spec.ts` — 픽스처(접두어 `E2E-T1 `/`e2et1_`): IN_PROGRESS 분과(담당 간사=시드 `gansa`), 그룹1/세부1/지표2, 대상1, 평가위원1(비번 `test1234`) 배정.
흐름:
```
1) 위원 로그인 → 대상 열기 → 지표2개 점수 입력 → 제출 확인 → 제출.
   assert: 재진입 시 입력 read-only + "간사 승인 대기" 배너.
2) 간사(gansa) 로그인 → /admin/sessions/{id}/progress → 제출 검토 표에서 그 행 "승인/반려" 클릭 → 모달 "반려".
   assert: 현황 '반려'.
3) 위원 재로그인 → 대상 → 편집 가능(반려 배너) → 점수 수정 → 재제출.
4) 간사 → 승인.
   assert: 현황 '승인'.
5) 관리자 → /admin/sessions/{id}/results → 순위표에 그 위원 점수 반영(승인분).
```
web-first 대기, 인쇄/모달 처리. `afterAll` 접두어 정리 + `$disconnect`.

- [ ] **Step 2: 실행**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npx playwright test e2e/submission-approval.spec.ts`
Expected: 전체 통과. 실패 시 원인 분석·수정(안전수칙 유지).

- [ ] **Step 3: 잔여 픽스처 0 확인**

프로젝트 루트 임시 스크립트로 `E2E-T1 ` 세션·`e2et1_` 유저·`E2E-T1 ` 기업 count=0, 시드 gansa=1 확인 후 임시 파일 삭제.

- [ ] **Step 4: 커밋**

```bash
git add e2e/submission-approval.spec.ts e2e/helpers.ts
git commit -m "test(e2e): 제출·반려·재제출·승인·집계 반영"
```

---

### Task 9: 전체 회귀 + 최종 검증

- [ ] **Step 1: 전체 유닛·컴포넌트 테스트**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm test 2>&1 | tail -4`
Expected: 모든 테스트 통과(기존 134 + 신규 submission·ReviewTable).

- [ ] **Step 2: 전체 e2e**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run test:e2e 2>&1 | tail -6`
Expected: 전체 통과.

- [ ] **Step 3: 빌드**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run build 2>&1 | grep -E "Compiled|Failed|✓ Generating"`
Expected: 성공.

---

## 실행 순서 메모
- Task 1→2→3→4→5→6→7→8→9 순서. Task 3·4는 Task 2의 헬퍼에 의존, Task 6은 Task 5의 `review`에 의존, Task 7은 Task 1의 Submission에 의존.
- 각 Task는 독립 커밋. 스키마·클라이언트 변경 후 dev 서버는 재시작 필요(Prisma client 갱신).
