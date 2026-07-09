# 분과 위원 승인 워크플로 + 관리자 검토완료 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 간사가 분과에 위원을 등록하고 관리자가 승인/반려(전체승인)하며, 미승인 위원은 평가 접근이 차단되고, 관리자가 집계에서 "검토 완료"를 누르면 분과가 완료된다.

**Architecture:** `Assignment`에 승인 상태(enum) 추가. "활성=APPROVED" 규칙을 순수 헬퍼로 두고 로그인·평가 홈/시트·점수 저장 지점에 적용. 승인/반려/검토완료는 관리자 전용 서버 액션. UI는 기존 "평가 위원 섭외 현황" 페이지와 집계 결과 페이지에 붙인다.

**Tech Stack:** Next.js 16 App Router(webpack) · React 19 · Prisma/Postgres(Neon) · Vitest · Playwright.

## Global Constraints

- Node 22로만 빌드/테스트: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` (dev 셸은 Node 21이라 vitest 깨짐).
- 마이그레이션 = 손수 작성 SQL + `npx prisma migrate deploy`. Neon DB는 local==prod 공유이므로 컬럼은 `ADD COLUMN IF NOT EXISTS`, enum은 `DO $$ … EXCEPTION WHEN duplicate_object THEN null; END $$` 로 멱등.
- **활성 배정 = `status === 'APPROVED'`**. 이 규칙 외 상태(PENDING/REJECTED)는 평가 접근 불가.
- 승인/반려/전체승인/검토완료 서버 액션은 **관리자 전용**(`assertMaster()`), 그 외 분과 접근은 `assertSessionAccess()`.
- 등록 주체가 관리자면 즉시 APPROVED, 간사면 PENDING.
- e2e: 고유 접두사 `E2E-APPR ` (세션/기업), `e2eappr_` (아이디). `afterAll`은 접두사 기준으로만 정리. 시드 계정(admin/admin1234=MASTER, gansa/gansa1234=SECRETARY) 절대 변경/삭제 금지. demo-seed 실행 금지.
- 커밋은 각 태스크 끝에서. 사용자가 별도로 푸시를 요청할 때만 푸시.

---

### Task 1: Assignment 승인 상태 스키마 + 마이그레이션 + 백필

**Files:**
- Modify: `prisma/schema.prisma` (Assignment 모델, 새 enum)
- Create: `prisma/migrations/20260709100000_assignment_status/migration.sql`

**Interfaces:**
- Produces: `Assignment.status: AssignmentStatus('PENDING'|'APPROVED'|'REJECTED')`, `Assignment.createdById: String?`, `Assignment.createdAt: DateTime`, `Assignment.decidedAt: DateTime?`; enum `AssignmentStatus`.

- [ ] **Step 1: 스키마 수정**

`prisma/schema.prisma`의 `model Assignment { … }`(현재 170~178행)를 아래로 교체하고, 파일 하단 다른 enum 근처에 새 enum을 추가한다.

```prisma
model Assignment {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      AssignmentStatus  @default(PENDING)
  createdById String?
  createdAt   DateTime          @default(now())
  decidedAt   DateTime?

  @@unique([sessionId, userId])
  @@index([sessionId])
}

enum AssignmentStatus {
  PENDING
  APPROVED
  REJECTED
}
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`prisma/migrations/20260709100000_assignment_status/migration.sql`:

```sql
-- 배정 승인 상태 (분과 × 위원)
DO $$ BEGIN
  CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);

-- 백필(1회): 기존 배정은 이미 활동 중이므로 승인 처리
UPDATE "Assignment" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
```

- [ ] **Step 3: 마이그레이션 적용 + 클라이언트 생성**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx prisma migrate deploy
npx prisma generate
```
Expected: `migrate deploy`가 새 마이그레이션 1건 적용, `generate` 성공.

- [ ] **Step 4: 스키마 반영 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.assignment.findMany({select:{id:true,status:true}}).then(r=>{console.log('rows',r.length,'sample',r[0]);return p.\$disconnect()}).catch(e=>{console.error(e.message);process.exit(1)})"
```
Expected: 에러 없이 `rows N sample { id, status: 'APPROVED' }`(기존 데이터가 있으면). 없으면 `rows 0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260709100000_assignment_status
git commit -m "feat(assignment): 승인 상태(status/createdById/createdAt/decidedAt) 추가 + 기존 배정 APPROVED 백필"
```

---

### Task 2: 순수 헬퍼 `lib/assignment.ts`

**Files:**
- Create: `lib/assignment.ts`
- Test: `lib/assignment.test.ts`

**Interfaces:**
- Produces:
  - `type AssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'`
  - `isAssignmentActive(status: AssignmentStatus): boolean`
  - `assignmentStatusLabel(status: AssignmentStatus): string`
  - `initialAssignmentStatus(actorRole: 'MASTER' | 'SECRETARY'): AssignmentStatus`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/assignment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isAssignmentActive, assignmentStatusLabel, initialAssignmentStatus } from './assignment'

describe('isAssignmentActive', () => {
  it('APPROVED만 활성', () => {
    expect(isAssignmentActive('APPROVED')).toBe(true)
    expect(isAssignmentActive('PENDING')).toBe(false)
    expect(isAssignmentActive('REJECTED')).toBe(false)
  })
})

describe('assignmentStatusLabel', () => {
  it('상태 라벨', () => {
    expect(assignmentStatusLabel('PENDING')).toBe('대기')
    expect(assignmentStatusLabel('APPROVED')).toBe('승인')
    expect(assignmentStatusLabel('REJECTED')).toBe('반려')
  })
})

describe('initialAssignmentStatus', () => {
  it('관리자 등록은 즉시 승인, 간사는 대기', () => {
    expect(initialAssignmentStatus('MASTER')).toBe('APPROVED')
    expect(initialAssignmentStatus('SECRETARY')).toBe('PENDING')
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx vitest run lib/assignment.test.ts
```
Expected: FAIL — `Failed to resolve import "./assignment"`.

- [ ] **Step 3: 구현**

`lib/assignment.ts`:

```ts
// 배정 승인 상태 관련 순수 유틸(관리 화면/게이트 판정). DB 비의존.
export type AssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// 위원이 평가에 참여 가능한 활성 상태인가(승인된 배정만)
export function isAssignmentActive(status: AssignmentStatus): boolean {
  return status === 'APPROVED'
}

const LABELS: Record<AssignmentStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
}
export function assignmentStatusLabel(status: AssignmentStatus): string {
  return LABELS[status]
}

// 등록 주체 역할에 따른 초기 상태: 관리자=즉시 승인, 간사=관리자 승인 대기
export function initialAssignmentStatus(actorRole: 'MASTER' | 'SECRETARY'): AssignmentStatus {
  return actorRole === 'MASTER' ? 'APPROVED' : 'PENDING'
}
```

- [ ] **Step 4: 통과 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx vitest run lib/assignment.test.ts
```
Expected: PASS (3 파일 내 테스트 통과).

- [ ] **Step 5: Commit**

```bash
git add lib/assignment.ts lib/assignment.test.ts
git commit -m "feat(assignment): 활성/라벨/초기상태 순수 헬퍼 + 테스트"
```

---

### Task 3: 평가 접근 게이트 — 미승인 위원 차단

**Files:**
- Modify: `app/login/actions.ts:20-25` (평가위원 로그인 카운트)
- Modify: `lib/evaluate-data.ts:152-155` (getHomeData 배정 조회), 그리고 `getSheetData`(31행~)의 배정 접근 검사
- Modify: `app/evaluate/actions.ts:54-57` (autoSaveScore), `app/evaluate/actions.ts:101-104` (saveScores)

**Interfaces:**
- Consumes: `Assignment.status`(Task 1).
- Produces: 미승인(PENDING/REJECTED) 위원은 로그인 게이트/홈 목록/시트/저장에서 배제.

- [ ] **Step 1: 로그인 카운트에 APPROVED 조건 추가**

`app/login/actions.ts`의 평가위원 분기(현재 20-25행) `activeCount` 쿼리를 수정:

```ts
    const activeCount = await prisma.assignment.count({
      where: { userId: user.id, status: 'APPROVED', session: { status: 'IN_PROGRESS' } },
    })
```

- [ ] **Step 2: getHomeData 배정 조회에 APPROVED 추가**

`lib/evaluate-data.ts`의 `getHomeData`(151행~) 내 `prisma.assignment.findMany({ where: { userId, session: { status: 'IN_PROGRESS' } }, … })`의 where를 다음으로:

```ts
      where: { userId, status: 'APPROVED', session: { status: 'IN_PROGRESS' } },
```

- [ ] **Step 3: getSheetData 배정 검사에 APPROVED 추가**

`lib/evaluate-data.ts`의 `getSheetData`(31행~)에서 해당 위원의 배정을 확인하는 부분을 찾는다. 배정 존재만 확인(`assignment.findUnique`/`findFirst` 또는 `where`)하는 곳에 `status: 'APPROVED'` 조건(또는 조회 후 `assignment.status !== 'APPROVED'`면 접근 거부)을 추가한다. 접근 거부 시 기존 코드가 반환하는 값(null/notFound 등)과 동일한 경로로 반환한다. (구현자는 함수 본문을 읽고 기존 미배정 처리와 같은 방식으로 미승인도 처리할 것.)

- [ ] **Step 4: autoSaveScore/saveScores 미승인 거부**

`app/evaluate/actions.ts` autoSaveScore(54-57행):

```ts
  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || assigned.status !== 'APPROVED') return { ok: false, error: 'not-assigned' }
```

saveScores(101-104행):

```ts
  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    select: { status: true },
  })
  if (!assigned || assigned.status !== 'APPROVED') return { error: '배정되지 않은 심사입니다.' }
```

- [ ] **Step 5: 빌드/타입 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`. (동작 검증은 Task 8 e2e에서.)

- [ ] **Step 6: Commit**

```bash
git add app/login/actions.ts lib/evaluate-data.ts app/evaluate/actions.ts
git commit -m "feat(evaluate): 미승인 배정 평가 접근 차단(로그인·홈·시트·저장 APPROVED 게이트)"
```

---

### Task 4: 간사의 위원 등록 — 전역 배정 상태 + 분과 내 신규 생성

**Files:**
- Modify: `app/admin/sessions/actions.ts` (`assignEvaluator` 546행~; 신규 `createEvaluatorForSession` 추가)

**Interfaces:**
- Consumes: `initialAssignmentStatus`(Task 2), `assertSessionAccess`(returns `{ user }`), `createEvaluator`용 유틸(`hashPassword`, `passwordFromPhone`).
- Produces:
  - `assignEvaluator(sessionId, formData)` — 배정 시 `status=initialAssignmentStatus(user.role)`, `createdById=user.id`.
  - `createEvaluatorForSession(sessionId, formData{name, phone})` — 위원 계정 생성 + 배정(PENDING/APPROVED).

- [ ] **Step 1: import 추가**

`app/admin/sessions/actions.ts` 상단 import에 다음을 보강(이미 있으면 생략):

```ts
import { initialAssignmentStatus } from '@/lib/assignment'
import { hashPassword } from '@/lib/auth'
import { passwordFromPhone } from '@/lib/phone'
import { randomUUID } from 'crypto'
```

- [ ] **Step 2: assignEvaluator 상태 반영**

`assignEvaluator`(546-556행)를 교체:

```ts
// 전역 풀의 기존 위원을 이 분과에 배정(폼: userId). 간사 배정은 PENDING, 관리자 배정은 즉시 APPROVED.
export async function assignEvaluator(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return
  const status = initialAssignmentStatus(user.role as 'MASTER' | 'SECRETARY')
  await prisma.assignment.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: { status, createdById: user.id, decidedAt: status === 'APPROVED' ? new Date() : null },
    create: { sessionId, userId, status, createdById: user.id, decidedAt: status === 'APPROVED' ? new Date() : null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}
```

- [ ] **Step 3: createEvaluatorForSession 추가**

`assignEvaluator` 바로 아래에 추가:

```ts
// 담당 간사(+관리자)가 이 분과에 새 위원 계정을 만들어 즉시 배정. 아이디/임시비번 자동.
export async function createEvaluatorForSession(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  if (!name || !phone) return
  const username = 'ev' + randomUUID().replace(/-/g, '').slice(0, 8)
  const password = passwordFromPhone(phone)
  const created = await prisma.user.create({
    data: { username, name, phone, role: 'EVALUATOR', passwordHash: await hashPassword(password), tempPassword: password },
  })
  const status = initialAssignmentStatus(user.role as 'MASTER' | 'SECRETARY')
  await prisma.assignment.create({
    data: { sessionId, userId: created.id, status, createdById: user.id, decidedAt: status === 'APPROVED' ? new Date() : null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}
```

- [ ] **Step 4: 빌드 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/sessions/actions.ts
git commit -m "feat(evaluators): 배정 시 승인상태 설정 + 분과 내 신규 위원 생성 액션"
```

---

### Task 5: 관리자 승인/반려/전체승인 + 검토완료 액션

**Files:**
- Modify: `app/admin/sessions/actions.ts` (신규 액션 4개)

**Interfaces:**
- Consumes: `assertMaster()`(lib/authz, 이미 존재 — role !== MASTER면 notFound), `assertSessionAccess`.
- Produces:
  - `approveAssignment(sessionId, userId)`
  - `rejectAssignment(sessionId, userId)` (위원장이면 chair 해제)
  - `approveAllAssignments(sessionId)`
  - `completeReview(sessionId)` — status=CLOSED, 조건 없음.

- [ ] **Step 1: import 확인**

`app/admin/sessions/actions.ts` 상단에서 `assertSessionAccess`는 이미 import됨. `assertMaster`를 추가:

```ts
import { assertSessionAccess, assertMaster } from '@/lib/authz'
```
(기존이 `import { assertSessionAccess } from '@/lib/authz'` 형태면 `assertMaster` 병합. 이미 다른 곳에서 `assertMaster`를 import 중이면 중복 주의.)

- [ ] **Step 2: 승인/반려/전체승인/검토완료 추가**

파일 하단(`rejectEvaluation` 뒤, 589행 근처)에 추가:

```ts
// ── 관리자: 배정 위원 승인/반려/검토완료 (MASTER 전용) ──

export async function approveAssignment(sessionId: string, userId: string) {
  await assertMaster()
  await prisma.assignment.update({
    where: { sessionId_userId: { sessionId, userId } },
    data: { status: 'APPROVED', decidedAt: new Date() },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

export async function rejectAssignment(sessionId: string, userId: string) {
  await assertMaster()
  await prisma.assignment.update({
    where: { sessionId_userId: { sessionId, userId } },
    data: { status: 'REJECTED', decidedAt: new Date() },
  })
  // 반려된 위원이 위원장이면 해제
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { chairId: true } })
  if (s?.chairId === userId) {
    await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: null } })
  }
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

export async function approveAllAssignments(sessionId: string) {
  await assertMaster()
  await prisma.assignment.updateMany({
    where: { sessionId, status: 'PENDING' },
    data: { status: 'APPROVED', decidedAt: new Date() },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// 관리자 검토 완료 → 분과 완료(CLOSED). 사전 조건 없음.
export async function completeReview(sessionId: string) {
  await assertMaster()
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status: 'CLOSED' } })
  revalidatePath(`/admin/sessions/${sessionId}`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}
```

- [ ] **Step 3: 빌드 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/sessions/actions.ts
git commit -m "feat(evaluators): 관리자 승인/반려/전체승인 + 검토완료(완료 전환) 액션"
```

---

### Task 6: "평가 위원 섭외 현황" 페이지 — 신규 생성 폼·상태 배지·관리자 승인 컨트롤

**Files:**
- Modify: `app/admin/sessions/[id]/evaluators/page.tsx`

**Interfaces:**
- Consumes: `assignmentStatusLabel`(Task 2), `assignEvaluator`/`createEvaluatorForSession`(Task 4), `approveAssignment`/`rejectAssignment`/`approveAllAssignments`(Task 5), `requireAdminUser`(현재 사용자 역할).

- [ ] **Step 1: import + 현재 역할 조회**

`app/admin/sessions/[id]/evaluators/page.tsx` 상단 import에 추가:

```ts
import { createEvaluatorForSession, approveAssignment, rejectAssignment, approveAllAssignments } from "../../actions";
import { assignmentStatusLabel, type AssignmentStatus } from "@/lib/assignment";
import { requireAdminUser } from "@/lib/authz";
```

`EvaluatorsContent`의 데이터 조회부에서 현재 사용자를 가져온다(맨 위):

```ts
async function EvaluatorsContent({ id }: { id: string }) {
  const me = await requireAdminUser();
  const isMaster = me.role === "MASTER";
  const [session, assignments] = await Promise.all([
    prisma.evaluationSession.findUnique({ where: { id } }),
    prisma.assignment.findMany({ where: { sessionId: id }, include: { user: true } }),
  ]);
```

- [ ] **Step 2: 상태 배지 헬퍼 + 전체 승인 버튼**

`orderedAssignments` 계산 뒤, `return (` 직전에 대기 건수 계산:

```ts
  const pendingCount = assignments.filter((a) => a.status === "PENDING").length;
  const badgeCls: Record<AssignmentStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-rose-50 text-rose-600",
  };
```

- [ ] **Step 3: 신규 위원 생성 폼 추가**

"평가위원 배정" 카드(현재 58-78행) 안, 기존 전역 풀 `form` 아래에 신규 생성 폼을 추가한다(마감 아닐 때만 노출되는 블록 내부):

```tsx
          {/* 신규 위원 생성(이 분과 전용) */}
          <form action={createEvaluatorForSession.bind(null, id)} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input name="name" required placeholder="새 위원 이름" className={`flex-1 ${inputCls}`} />
            <input name="phone" required placeholder="연락처(임시비번=끝 4자리)" className={`flex-1 ${inputCls}`} />
            <button className="shrink-0 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
              신규 등록
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            {isMaster ? "관리자가 등록하면 즉시 승인됩니다." : "간사가 등록한 위원은 관리자 승인 후 평가에 참여할 수 있습니다."}
          </p>
```

- [ ] **Step 4: 배정 위원 테이블에 상태·승인 컨트롤 추가**

"배정된 평가위원" 카드 헤더(83-86행)에 대기 시 전체 승인 버튼(관리자 전용):

```tsx
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 font-semibold">
          <span>
            배정된 평가위원 ({assignments.length})
            {pendingCount > 0 && <span className="ml-2 text-xs font-normal text-amber-600">· 승인 대기 {pendingCount}</span>}
          </span>
          {isMaster && pendingCount > 0 && (
            <form action={approveAllAssignments.bind(null, id)}>
              <button className="rounded-md bg-[var(--gov-navy)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">전체 승인</button>
            </form>
          )}
        </div>
```

테이블 헤더(`<tr>` 89-96행)에 "상태" 열을 이름 다음에 추가:

```tsx
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">상태</th>
```

각 행(`<tr>` 102행~)에서 이름 셀 다음에 상태 셀을 추가하고, 관리자면 승인/비승인 버튼을 노출한다. 이름 셀 바로 뒤에 삽입:

```tsx
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls[a.status as AssignmentStatus]}`}>
                      {assignmentStatusLabel(a.status as AssignmentStatus)}
                    </span>
                    {isMaster && a.status !== "APPROVED" && (
                      <form action={approveAssignment.bind(null, id, a.userId)} className="mt-1 inline-block">
                        <button className="text-xs text-emerald-700 hover:underline">승인</button>
                      </form>
                    )}
                    {isMaster && a.status !== "REJECTED" && (
                      <form action={rejectAssignment.bind(null, id, a.userId)} className="ml-2 mt-1 inline-block">
                        <button className="text-xs text-rose-600 hover:underline">비승인</button>
                      </form>
                    )}
                  </td>
```

빈 목록 `colSpan`(현재 145행 `locked ? 5 : 6`)을 상태 열 추가에 맞춰 `locked ? 6 : 7`로 조정한다.

- [ ] **Step 5: 빌드 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/sessions/[id]/evaluators/page.tsx"
git commit -m "feat(evaluators): 신규 생성 폼 + 상태 배지 + 관리자 승인/비승인/전체승인 UI"
```

---

### Task 7: 집계 결과 "검토 완료" 버튼(관리자) + 전역 위원 메뉴 관리자 전용

**Files:**
- Create: `app/admin/sessions/[id]/results/CompleteReviewButton.tsx`
- Modify: `app/admin/sessions/[id]/results/page.tsx`
- Modify: `components/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `completeReview`(Task 5), `requireAdminUser`.

- [ ] **Step 1: 검토완료 버튼(클라이언트)**

`app/admin/sessions/[id]/results/CompleteReviewButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReview } from "@/app/admin/sessions/actions";

export default function CompleteReviewButton({ sessionId, closed }: { sessionId: string; closed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (closed) {
    return <span className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">검토 완료됨</span>;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("이 분과의 검토를 완료하고 '완료' 상태로 전환할까요? 점수가 잠깁니다.")) return;
        start(async () => {
          await completeReview(sessionId);
          router.refresh();
        });
      }}
      className="rounded-lg bg-[var(--gov-navy)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "처리 중…" : "검토 완료"}
    </button>
  );
}
```

- [ ] **Step 2: 결과 페이지 상단에 버튼(관리자 전용)**

`app/admin/sessions/[id]/results/page.tsx`에서 import 추가:

```ts
import CompleteReviewButton from "./CompleteReviewButton";
import { requireAdminUser } from "@/lib/authz";
```

`ResultsContent`에서 현재 사용자/역할과 세션 상태를 확보한다. 기존 `Promise.all` 결과에 `session`이 있으므로, 함수 초입에 다음을 추가:

```ts
  const me = await requireAdminUser();
```

그리고 상단 컨트롤(현재 화면 전용 `<p>` 근처)을 다음처럼 바꿔 관리자에게 버튼을 노출:

```tsx
      {/* 화면 전용 컨트롤 */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">위원 평균 점수 기준 선정 결과입니다.</p>
        {me.role === "MASTER" && <CompleteReviewButton sessionId={id} closed={session?.status === "CLOSED"} />}
      </div>
```

- [ ] **Step 3: 사이드바 전역 위원 메뉴 관리자 전용**

`components/AdminSidebar.tsx`에서 `/admin/evaluators` 링크(413-419행)를 `isMaster`일 때만 렌더하도록 감싼다:

```tsx
          {isMaster && (
            <Link
              href="/admin/evaluators"
              className={topCls(pathname.startsWith("/admin/evaluators"))}
            >
              <UsersIcon />
              평가위원·간사 관리
            </Link>
          )}
```

(간사에게는 전역 위원 메뉴가 사라진다. 위원 등록은 분과 "평가 위원 섭외 현황"에서만.)

- [ ] **Step 4: 전역 위원 페이지 관리자 전용 가드**

`app/admin/evaluators/page.tsx` 최상단에서 `assertMaster()`를 호출하도록 한다. 파일을 읽어 페이지 컴포넌트(또는 데이터 컴포넌트) 초입에 다음을 추가(이미 `requireAdminUser`만 있으면 `assertMaster`로 교체):

```ts
import { assertMaster } from "@/lib/authz";
// …
  await assertMaster();
```

- [ ] **Step 5: 빌드 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/sessions/[id]/results/CompleteReviewButton.tsx" "app/admin/sessions/[id]/results/page.tsx" components/AdminSidebar.tsx "app/admin/evaluators/page.tsx"
git commit -m "feat(results): 관리자 검토완료 버튼 + 전역 위원 메뉴/페이지 관리자 전용"
```

---

### Task 8: e2e — 등록→승인→접근, 반려→차단, 검토완료→완료

**Files:**
- Create: `e2e/evaluator-approval.spec.ts`
- Reference: `e2e/helpers.ts`(기존 `loginAs`, 접두사 유틸), `e2e/submission-approval.spec.ts`(패턴 참고)

**Interfaces:**
- Consumes: 시드 계정 admin/admin1234(MASTER), gansa/gansa1234(SECRETARY). 담당 간사 소유 분과가 필요.

- [ ] **Step 1: 시나리오 스펙 작성**

`e2e/evaluator-approval.spec.ts` — 아래 흐름을 담는다. 실제 셀렉터/헬퍼는 `e2e/helpers.ts`와 `submission-approval.spec.ts`를 읽어 동일 규칙으로 작성한다.

핵심 단계:
1. `beforeAll`: 관리자로 로그인해 `E2E-APPR 분과` 세션 생성(담당 간사=gansa) + `IN_PROGRESS` + 평가지표 1개 + 대상 1개(`E2E-APPR 기업`). (submission-approval 스펙의 셋업 재사용.)
2. 간사(gansa) 로그인 → 해당 분과 "평가 위원 섭외 현황"에서 신규 위원 `E2E-APPR 위원`(연락처 `01000009999`) 등록 → 상태 배지 "대기" 확인.
3. 그 위원 계정으로 로그인 시도 → 로그인 차단 메시지(`EVALUATOR_NO_ACTIVE_SESSION_MESSAGE`) 확인. (아이디는 자동 생성되므로, 등록 직후 DB에서 조회하거나 PasswordCell/행에서 노출되는 아이디·임시비번을 읽어 사용. 임시비번=연락처 끝 4자리 `9999`.)
4. 관리자 로그인 → 같은 페이지에서 그 위원 "승인" 클릭 → 배지 "승인".
5. 위원 로그인 성공 → 평가 홈에 `E2E-APPR 분과` 노출.
6. 관리자가 집계 결과에서 "검토 완료" → 분과 상태 "완료"(사이드바/헤더 배지) 확인.
7. (반려 경로) 별도 위원 등록 후 관리자 "비승인" → 위원 로그인 차단 확인.

- [ ] **Step 2: afterAll 정리**

접두사 기준 정리만 수행(다른 스펙 패턴과 동일):

```ts
test.afterAll(async () => {
  // E2E-APPR 접두사 세션/기업/위원(e2eappr_ 또는 생성된 위원 name 'E2E-APPR 위원')만 삭제.
  // 시드 계정(admin/gansa) 및 다른 접두사 데이터는 절대 건드리지 않는다.
})
```

정확한 삭제 쿼리는 `submission-approval.spec.ts`의 `afterAll`/헬퍼를 따른다(세션 cascade 삭제 + 생성한 위원 User 삭제). 생성 위원은 `name: 'E2E-APPR 위원'`으로 조회해 삭제.

- [ ] **Step 3: e2e 실행**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx playwright test e2e/evaluator-approval.spec.ts
```
Expected: 전 케이스 통과. 실패 시 셀렉터/타이밍(모달 닫힘·router.refresh 반영 대기) 조정.

- [ ] **Step 4: 회귀 — 기존 위원 e2e 확인**

배정 상태 도입으로 기존 배정이 APPROVED 백필됐는지 의존하는 스펙(secretary-monitoring, submission-approval)이 여전히 통과하는지 확인:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx playwright test e2e/secretary-monitoring.spec.ts e2e/submission-approval.spec.ts
```
Expected: 통과. (이 스펙들이 위원을 새로 배정한다면 `assignEvaluator`가 이제 PENDING을 만들 수 있으니, 필요 시 해당 셋업을 관리자(admin) 계정으로 수행하거나 스펙에서 승인 단계를 추가한다.)

- [ ] **Step 5: Commit**

```bash
git add e2e/evaluator-approval.spec.ts
git commit -m "test(e2e): 위원 등록→승인→접근, 반려→차단, 검토완료→완료"
```

---

### Task 9: 전체 회귀 · 최종 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 단위 테스트 전체**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx vitest run
```
Expected: 전부 통과(신규 assignment 테스트 포함).

- [ ] **Step 2: 빌드**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -E "Compiled|Failed|error TS"
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: e2e 핵심 스펙**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx playwright test e2e/evaluator-approval.spec.ts e2e/secretary-monitoring.spec.ts e2e/submission-approval.spec.ts
```
Expected: 통과.

- [ ] **Step 4: 수동 점검 체크리스트(문서화)**
  - 간사: 분과에서 신규 위원 등록 → 대기 배지, 전역 위원 메뉴 미노출.
  - 관리자: 승인/비승인/전체승인 동작, 승인 후 위원 로그인·평가 가능, 반려 시 차단.
  - 관리자: 집계 결과 "검토 완료" → 분과 완료·점수 잠금. 간사에겐 버튼 미노출.

---

## Self-Review 메모

- 스펙 A~G 전부 태스크에 매핑됨: A→T1, B(헬퍼)→T2, 접근차단(E)→T3, 등록(C)→T4, 승인/검토완료 액션(D·F)→T5, 승인 UI(D)→T6, 검토완료 버튼(F)+전역메뉴(G)→T7, 테스트→T8·T9.
- 타입 일관성: `AssignmentStatus`/`initialAssignmentStatus`/`assignmentStatusLabel`/`isAssignmentActive`가 T2에서 정의되고 T3·T4·T6에서 동일 시그니처로 사용됨.
- `assertMaster`는 lib/authz에 이미 존재(재정의 금지, import만).
- 미해결 가능성: `getSheetData`의 배정 검사 위치는 구현자가 함수 본문을 읽고 기존 미배정 처리와 동일 경로로 미승인도 막아야 함(T3 Step3). 전역 위원 페이지의 기존 가드 형태는 파일 확인 후 `assertMaster`로 맞춤(T7 Step4).
