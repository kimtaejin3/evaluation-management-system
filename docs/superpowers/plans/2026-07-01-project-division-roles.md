# 과제·분과 계층 + 마스터/간사/평가위원 역할 개편 — 구현 계획 (1차)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 superpowers:executing-plans 로 task 단위 실행. 스텝은 `- [ ]` 체크박스.

**Goal:** 과제(Project)를 최상위로 도입하고 마스터/간사/평가위원 3역할로 개편해, 마스터가 과제·간사를 관리하고 간사가 배정된 과제 하위에서 자기 분과를 구성(평가계획 등록)하도록 한다.

**Architecture:** 기존 `/admin` 유지 + 역할 게이트. Prisma에 `Project` 모델·`EvaluationSession.projectId/secretaryId`·`Project↔User(간사)` 다대다 추가, `Role`을 `MASTER/SECRETARY/EVALUATOR`로 변경(ADMIN→MASTER 이관). 권한은 서버 컴포넌트/액션의 공통 가드(`lib/authz.ts`)로 강제.

**Tech Stack:** Next.js 16(App Router, webpack) · Prisma(Postgres/Neon) · vitest(단위, Node≥20.19 `.nvmrc`=22) · tsx 통합 스크립트 · Playwright.

## Global Constraints
- **Node 실행**: 테스트/빌드는 Node 22 — `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`. (dev용 21은 vitest 불가)
- **빌드 게이트**: `npm run build`(= `next build --webpack`)가 타입체크 포함 진짜 게이트.
- **마이그레이션**: 손수 SQL + `npx prisma migrate deploy`(shadow DB 회피). 마이그레이션 폴더명 `YYYYMMDDHHMMSS_<name>`.
- **커밋 메시지 말미**: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **가드 위반 응답**: 정보노출 최소화 위해 `notFound()`.
- **역할 값**: `MASTER` · `SECRETARY` · `EVALUATOR` (대문자, 정확히).

---

## File Structure (책임 경계)
- `prisma/schema.prisma` — Project 모델, Session FK, Role enum, User 역관계.
- `prisma/migrations/<ts>_project_and_roles/migration.sql` — 스키마 변경 SQL(+ ADMIN→MASTER 데이터 이관).
- `lib/authz.ts` (신규) — 역할·소유 가드 순수/서버 헬퍼. **단위 테스트 대상은 순수 함수만.**
- `lib/authz.test.ts` (신규) — 순수 판정 함수 단위 테스트.
- `app/login/actions.ts` — 역할별 로그인 리다이렉트.
- `app/admin/layout.tsx` — `/admin` 역할 게이트(MASTER/SECRETARY만) + 사이드바 데이터 스코프.
- `app/admin/projects/**` (신규) — 과제 목록/생성/상세 + 액션.
- `app/admin/sessions/actions.ts` — `createSession`에 project/secretary + 분과 액션 가드.
- `app/admin/sessions/new/page.tsx` — 과제 선택(스코프).
- `app/admin/sessions/[id]/layout.tsx` — 분과 소유 가드.
- `components/AdminSidebar.tsx` — 역할별 메뉴.
- `app/admin/evaluators/page.tsx` + `app/admin/actions.ts` — 간사 계정 생성/역할 지정(마스터).
- `prisma/seed.ts`, `scripts/demo-seed.ts` — 역할·시드.
- `e2e/auth.spec.ts` — 새 로그인 리다이렉트.

---

## Task 1: 스키마·마이그레이션 (Project, Session FK, Role)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260701170000_project_and_roles/migration.sql`

**Interfaces (Produces):**
- `Project { id, name, description?, dueDate?, secretaries User[], sessions EvaluationSession[], createdAt }`
- `EvaluationSession.projectId String?`, `EvaluationSession.secretaryId String?`
- `Role` enum: `MASTER | SECRETARY | EVALUATOR`
- `User.assignedProjects Project[] @relation("ProjectSecretaries")`, `User.secretariedSessions EvaluationSession[] @relation("SessionSecretary")`

- [ ] **Step 1: schema.prisma 편집**

`enum Role` 교체:
```prisma
enum Role {
  MASTER
  SECRETARY
  EVALUATOR
}
```
`model Project` 추가(파일 상단 User 근처):
```prisma
model Project {
  id          String              @id @default(cuid())
  name        String
  description String?
  dueDate     DateTime?
  secretaries User[]              @relation("ProjectSecretaries")
  sessions    EvaluationSession[]
  createdAt   DateTime            @default(now())
}
```
`model User`에 역관계 2줄 추가:
```prisma
  assignedProjects     Project[]           @relation("ProjectSecretaries")
  secretariedSessions  EvaluationSession[] @relation("SessionSecretary")
```
`model EvaluationSession`에 필드/관계 추가:
```prisma
  projectId   String?
  project     Project?          @relation(fields: [projectId], references: [id], onDelete: SetNull)
  secretaryId String?
  secretary   User?             @relation("SessionSecretary", fields: [secretaryId], references: [id], onDelete: SetNull)
```

- [ ] **Step 2: 마이그레이션 SQL 작성** (`.../migration.sql`)

```sql
-- Role: ADMIN → MASTER 이관 + SECRETARY 추가
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('MASTER', 'SECRETARY', 'EVALUATOR');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING (
  (CASE "role"::text WHEN 'ADMIN' THEN 'MASTER' ELSE "role"::text END)::"Role"
);
DROP TYPE "Role_old";

-- Project
CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- EvaluationSession FK 컬럼
ALTER TABLE "EvaluationSession" ADD COLUMN "projectId" TEXT;
ALTER TABLE "EvaluationSession" ADD COLUMN "secretaryId" TEXT;
ALTER TABLE "EvaluationSession" ADD CONSTRAINT "EvaluationSession_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvaluationSession" ADD CONSTRAINT "EvaluationSession_secretaryId_fkey"
  FOREIGN KEY ("secretaryId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 과제-간사 다대다(Prisma 암시적 m2m: A=Project, B=User)
CREATE TABLE "_ProjectSecretaries" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ProjectSecretaries_AB_unique" ON "_ProjectSecretaries"("A", "B");
CREATE INDEX "_ProjectSecretaries_B_index" ON "_ProjectSecretaries"("B");
ALTER TABLE "_ProjectSecretaries" ADD CONSTRAINT "_ProjectSecretaries_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProjectSecretaries" ADD CONSTRAINT "_ProjectSecretaries_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: 적용 + 클라이언트 생성**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx prisma migrate deploy && npx prisma generate
```
Expected: "All migrations have been successfully applied." + generate 성공.

- [ ] **Step 4: 타입 확인 빌드**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error|Failed"
```
Expected: `Compiled successfully`. (역할 문자열 `ADMIN` 참조가 남아 타입에러가 날 수 있음 → Task 2~7에서 정리. 이 스텝은 스키마 컴파일 확인용이며, ADMIN 참조 에러가 있으면 다음 태스크에서 해소된다고 기록하고 진행.)

- [ ] **Step 5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20260701170000_project_and_roles
git commit -m "feat(schema): Project 도입 + 분과 project/secretary + Role(MASTER/SECRETARY/EVALUATOR)"
```

---

## Task 2: 권한 헬퍼 `lib/authz.ts` (+ 단위 테스트)

**Files:**
- Create: `lib/authz.ts`, `lib/authz.test.ts`

**Interfaces (Produces):**
- `type Role = 'MASTER' | 'SECRETARY' | 'EVALUATOR'`
- 순수: `canManageSession(role: Role, userId: string, session: { secretaryId: string | null }): boolean`
- 순수: `canAccessProject(role: Role, userId: string, project: { secretaries: { id: string }[] }): boolean`
- 서버: `requireAdminUser(): Promise<{ id, role, name }>` — 로그인+MASTER/SECRETARY 아니면 redirect('/login') / notFound.
- 서버: `assertSessionAccess(sessionId): Promise<{ user, session }>` — 미로그인 redirect, 권한없음 notFound.
- 서버: `assertProjectAccess(projectId)`, `assertMaster()`.

- [ ] **Step 1: 실패 테스트 작성** (`lib/authz.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { canManageSession, canAccessProject } from './authz'

describe('canManageSession', () => {
  it('마스터는 모든 분과 관리', () => {
    expect(canManageSession('MASTER', 'u1', { secretaryId: 'other' })).toBe(true)
    expect(canManageSession('MASTER', 'u1', { secretaryId: null })).toBe(true)
  })
  it('간사는 자기 분과만', () => {
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: 'u1' })).toBe(true)
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: 'u2' })).toBe(false)
    expect(canManageSession('SECRETARY', 'u1', { secretaryId: null })).toBe(false)
  })
  it('평가위원은 불가', () => {
    expect(canManageSession('EVALUATOR', 'u1', { secretaryId: 'u1' })).toBe(false)
  })
})

describe('canAccessProject', () => {
  it('마스터는 모든 과제', () => {
    expect(canAccessProject('MASTER', 'u1', { secretaries: [] })).toBe(true)
  })
  it('간사는 배정된 과제만', () => {
    expect(canAccessProject('SECRETARY', 'u1', { secretaries: [{ id: 'u1' }] })).toBe(true)
    expect(canAccessProject('SECRETARY', 'u1', { secretaries: [{ id: 'u2' }] })).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm test -- lib/authz.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: `lib/authz.ts` 구현**

```ts
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export type Role = 'MASTER' | 'SECRETARY' | 'EVALUATOR'

// 순수 판정 — 분과 관리 권한
export function canManageSession(role: Role, userId: string, session: { secretaryId: string | null }): boolean {
  if (role === 'MASTER') return true
  if (role === 'SECRETARY') return !!session.secretaryId && session.secretaryId === userId
  return false
}

// 순수 판정 — 과제 접근 권한
export function canAccessProject(role: Role, userId: string, project: { secretaries: { id: string }[] }): boolean {
  if (role === 'MASTER') return true
  if (role === 'SECRETARY') return project.secretaries.some((s) => s.id === userId)
  return false
}

// 로그인 + 관리영역(마스터/간사) 강제
export async function requireAdminUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'MASTER' && user.role !== 'SECRETARY') notFound()
  return user
}

export async function assertMaster() {
  const user = await requireAdminUser()
  if (user.role !== 'MASTER') notFound()
  return user
}

// 분과 접근 — 권한 없으면 notFound
export async function assertSessionAccess(sessionId: string) {
  const user = await requireAdminUser()
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session) notFound()
  if (!canManageSession(user.role as Role, user.id, session)) notFound()
  return { user, session }
}

// 과제 접근 — 권한 없으면 notFound
export async function assertProjectAccess(projectId: string) {
  const user = await requireAdminUser()
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { secretaries: { select: { id: true } } } })
  if (!project) notFound()
  if (!canAccessProject(user.role as Role, user.id, project)) notFound()
  return { user, project }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm test -- lib/authz.test.ts
git add lib/authz.ts lib/authz.test.ts
git commit -m "feat(authz): 역할·소유 권한 가드(순수 판정+서버 assert)"
```
Expected: PASS.

---

## Task 3: 로그인 리다이렉트 + /admin 역할 게이트

**Files:**
- Modify: `app/login/actions.ts:32`, `app/admin/layout.tsx`

**Interfaces (Consumes):** `requireAdminUser` (Task 2).

- [ ] **Step 1: 로그인 리다이렉트 변경** (`app/login/actions.ts`)

`redirect(user.role === 'ADMIN' ? '/admin/sessions' : '/evaluate')` 를:
```ts
if (user.role === 'MASTER') redirect('/admin/projects')
if (user.role === 'SECRETARY') redirect('/admin/sessions')
redirect('/evaluate')
```
(위 `EVALUATOR` 게이트 블록은 그대로 둔다.)

- [ ] **Step 2: admin 레이아웃 역할 게이트** (`app/admin/layout.tsx`)

`getCurrentUser()` 대신 `requireAdminUser()`(import from `@/lib/authz`) 사용해 EVALUATOR 접근 차단. 사이드바 세션 목록은 역할 스코프:
```ts
const user = await requireAdminUser()
const sessions = await prisma.evaluationSession.findMany({
  where: user.role === 'MASTER' ? {} : { secretaryId: user.id },
  orderBy: { createdAt: 'desc' },
  select: { id: true, name: true, status: true },
})
```
헤더의 `님 · 관리자` → `님 · ${user.role === 'MASTER' ? '마스터' : '간사'}`. `AdminSidebar`에 `role={user.role}` prop 추가(Task 6에서 사용).

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
git add app/login/actions.ts app/admin/layout.tsx
git commit -m "feat(auth): 역할별 로그인 리다이렉트 + /admin 게이트(마스터/간사)"
```
Expected: `Compiled successfully` (AdminSidebar role prop 미사용 경고는 Task 6에서 해소).

---

## Task 4: 과제(Project) 관리 — 목록/생성/상세 + 액션 (마스터)

**Files:**
- Create: `app/admin/projects/page.tsx`, `app/admin/projects/new/page.tsx`, `app/admin/projects/[id]/page.tsx`, `app/admin/projects/actions.ts`

**Interfaces (Produces):**
- 액션: `createProject(formData)`, `assignSecretaryToProject(projectId, formData)`, `removeSecretaryFromProject(projectId, userId)`

- [ ] **Step 1: `app/admin/projects/actions.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { assertMaster, assertProjectAccess } from '@/lib/authz'

export async function createProject(formData: FormData) {
  await assertMaster()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const p = await prisma.project.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      dueDate: formData.get('dueDate') ? new Date(String(formData.get('dueDate'))) : null,
    },
  })
  redirect(`/admin/projects/${p.id}`)
}

export async function assignSecretaryToProject(projectId: string, formData: FormData) {
  await assertMaster()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { connect: { id: userId } } } })
  revalidatePath(`/admin/projects/${projectId}`)
}

export async function removeSecretaryFromProject(projectId: string, userId: string) {
  await assertMaster()
  await prisma.project.update({ where: { id: projectId }, data: { secretaries: { disconnect: { id: userId } } } })
  revalidatePath(`/admin/projects/${projectId}`)
}
```

- [ ] **Step 2: 과제 목록** (`app/admin/projects/page.tsx`)

`assertMaster()` 후 `prisma.project.findMany({ orderBy:{createdAt:'desc'}, include:{ _count:{ select:{ sessions:true } }, secretaries:{ select:{ name:true } } } })`. 각 과제 카드: 이름·설명·분과 수·담당 간사 목록, `/admin/projects/[id]` 링크. 상단 "새 과제"(→ `/admin/projects/new`). (기존 `/admin/sessions/page.tsx`의 카드 마크업 패턴 재사용.)

- [ ] **Step 3: 새 과제** (`app/admin/projects/new/page.tsx`)

`assertMaster()`. `<form action={createProject}>`: name(필수)·description·dueDate(datetime-local). (기존 `sessions/new/page.tsx` 폼 패턴 재사용.)

- [ ] **Step 4: 과제 상세** (`app/admin/projects/[id]/page.tsx`)

`await assertProjectAccess(id)`. 표시: 과제 정보 + **담당 간사 배정**(마스터만: `assignSecretaryToProject` 폼 — role=SECRETARY 사용자 select + 배정, 각 간사 옆 해제 버튼 `removeSecretaryFromProject`) + **소속 분과 목록**(project.sessions, 각 `/admin/sessions/[id]`, 상태 배지) + "분과 추가"(→ `/admin/sessions/new?projectId=${id}`).

- [ ] **Step 5: 빌드 + 수동 확인 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
git add app/admin/projects
git commit -m "feat(projects): 과제 목록/생성/상세 + 담당 간사 배정(마스터)"
```
Expected: `Compiled successfully`.

---

## Task 5: 분과 생성(과제 하위)·스코프 가드

**Files:**
- Modify: `app/admin/sessions/actions.ts` (`createSession` + 분과 액션 가드), `app/admin/sessions/new/page.tsx`, `app/admin/sessions/[id]/layout.tsx`

**Interfaces (Consumes):** `assertProjectAccess`, `assertSessionAccess`, `requireAdminUser` (Task 2).

- [ ] **Step 1: `createSession` 개편** (`app/admin/sessions/actions.ts`)

```ts
export async function createSession(formData: FormData) {
  const user = await requireAdminUser()
  const name = String(formData.get('name') ?? '').trim()
  const projectId = String(formData.get('projectId') ?? '').trim()
  if (!name || !projectId) return
  // 과제 접근 권한 검증(간사는 배정된 과제만)
  await assertProjectAccess(projectId)
  const session = await prisma.evaluationSession.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      location: String(formData.get('location') ?? '') || null,
      eventDate: formData.get('eventDate') ? new Date(String(formData.get('eventDate'))) : null,
      projectId,
      secretaryId: user.role === 'SECRETARY' ? user.id : (String(formData.get('secretaryId') ?? '') || null),
    },
  })
  redirect(`/admin/sessions/${session.id}`)
}
```
`requireAdminUser`, `assertProjectAccess` import 추가.

- [ ] **Step 2: 분과 관련 액션 가드**

`app/admin/sessions/actions.ts`의 분과 변경 액션(`addCriterion`, `updateCriterion`, `deleteCriterion`, `renameSection`, `addSubject`, `deleteSubject`, `uploadSubjectDocument`, `deleteSubjectDocument`, `assignEvaluator`, `removeEvaluator`, `setChair`, `setSessionStatus`, `deleteSession`, `duplicateSession`, `commitKpassImport`, `commitEvaluatorImport`, `commitSubjectImport`) 진입부에 `await assertSessionAccess(sessionId)` 추가(첫 인자가 sessionId). 이미 로그인/권한을 검증하므로 중복 쿼리는 허용(YAGNI: 캐싱 안 함).

- [ ] **Step 3: 분과 생성 폼 — 과제 선택** (`app/admin/sessions/new/page.tsx`)

`requireAdminUser()`. 접근 가능 과제 조회: 마스터=전체, 간사=`assignedProjects`. `searchParams.projectId` 있으면 기본 선택. `<select name="projectId" required>` 추가(옵션=접근 가능 과제). 접근 가능 과제 0개면 "배정된 과제가 없습니다" 안내.

- [ ] **Step 4: 분과 상세 레이아웃 가드** (`app/admin/sessions/[id]/layout.tsx`)

최상단에서 `await assertSessionAccess(id)` 호출(권한 없으면 notFound). 기존 `notFound()` 세션조회는 이 헬퍼로 대체.

- [ ] **Step 5: 빌드 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
git add app/admin/sessions
git commit -m "feat(sessions): 과제 하위 분과 생성 + 소유/역할 가드"
```

---

## Task 6: 사이드바 역할별 메뉴

**Files:** Modify `components/AdminSidebar.tsx`

**Interfaces (Consumes):** `role` prop (Task 3에서 전달).

- [ ] **Step 1: `AdminSidebar`에 `role: 'MASTER' | 'SECRETARY'` prop 추가**

글로벌 모드 상단 링크를 역할 분기:
- 공통: `평가위원 관리`, `기업 관리`.
- MASTER: `과제 관리`(`/admin/projects`, active=`pathname.startsWith('/admin/projects')`).
- SECRETARY: `내 분과`(`/admin/sessions`, active=`/admin/sessions` 계열). 그 아래 전달받은 `sessions`(이미 secretaryId 스코프됨) 목록.
- MASTER의 세션 하위 목록은 과제 중심이므로 제거하거나 유지(YAGNI: 유지). 분과명 옆 진행상태 텍스트는 현행 유지.

- [ ] **Step 2: 빌드 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
git add components/AdminSidebar.tsx
git commit -m "feat(ui): 사이드바 역할별 메뉴(마스터=과제 관리 / 간사=내 분과)"
```

---

## Task 7: 간사 계정 생성·역할 지정 (마스터)

**Files:** Modify `app/admin/actions.ts` (`createEvaluator`→역할 인자), `app/admin/evaluators/page.tsx`

- [ ] **Step 1: `createEvaluator`에 role 지정 허용** (`app/admin/actions.ts`)

`const role = String(formData.get('role') ?? 'EVALUATOR') === 'SECRETARY' ? 'SECRETARY' : 'EVALUATOR'` 추가, upsert의 create/update `role` 반영. (MASTER는 UI에서 생성 불가.) 함수 상단 `await assertMaster()`.

- [ ] **Step 2: 평가위원 관리 페이지** (`app/admin/evaluators/page.tsx`)

`assertMaster()`(마스터만 전역 위원/간사 관리 — 1차 결정). 생성 폼에 `<select name="role">` (평가위원/간사) 추가. 목록에 역할 컬럼 표시(EVALUATOR/SECRETARY). 간사도 목록에 포함(현재 `role: 'EVALUATOR'` 필터를 `{ role: { in: ['EVALUATOR','SECRETARY'] } }` 로).

- [ ] **Step 3: 빌드 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
git add app/admin/actions.ts app/admin/evaluators/page.tsx
git commit -m "feat(users): 간사 계정 생성·역할 지정(마스터)"
```

---

## Task 8: 시드/데모 + 남은 ADMIN 참조 정리

**Files:** Modify `prisma/seed.ts`, `scripts/demo-seed.ts`, 잔여 `'ADMIN'` 문자열 참조 파일들.

- [ ] **Step 1: 잔여 참조 탐색**

```bash
grep -rn "'ADMIN'\|\"ADMIN\"\|role === 'ADMIN'\|관리자" app lib prisma scripts components | grep -v node_modules
```
각 참조를 역할 의미에 맞게 수정(대개 MASTER 또는 MASTER/SECRETARY). 로그인 게이트(`login-rules`, `session-rules`)의 ADMIN 예외도 MASTER로.

- [ ] **Step 2: 시드 역할 반영**

`prisma/seed.ts`: admin 계정 role `ADMIN`→`MASTER`. 간사 1명(`gansa`/`SECRETARY`)·샘플 과제 1개 + 분과 연결 추가. `scripts/demo-seed.ts` 동일 반영 + 기존 데모 분과에 project/secretary 지정.

- [ ] **Step 3: 전체 테스트 + 커밋**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm test 2>&1 | tail -3
npm run test:core 2>&1 | tail -2
git add prisma/seed.ts scripts/demo-seed.ts app lib components
git commit -m "chore: ADMIN→MASTER 잔여 참조 정리 + 시드 역할/과제 반영"
```

---

## Task 9: e2e 갱신 + 최종 검증

**Files:** Modify `e2e/auth.spec.ts` (필요 시 `e2e/import.spec.ts`).

- [ ] **Step 1: auth e2e 갱신**

`admin`/`admin1234`는 이제 MASTER → 로그인 후 `/admin/projects`, 헤딩 `과제 관리`:
```ts
await page.waitForURL('**/admin/projects')
await expect(page.getByRole('heading', { name: '과제 관리' })).toBeVisible()
```
간사 로그인 케이스 추가(시드 `gansa` 계정) → `/admin/sessions`(내 분과). import e2e는 분과 생성 전 **과제 선택**이 필요하므로, 흐름을 "과제 생성 → 분과 생성(과제 선택) → 평가 항목 가져오기"로 갱신.

- [ ] **Step 2: 전체 스위트**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build 2>&1 | grep -iE "Compiled successfully|Type error"
npm test 2>&1 | tail -3
npx playwright test 2>&1 | tail -6
```
Expected: 빌드 성공, 단위 전부 통과, e2e 통과.

- [ ] **Step 3: 수용 기준 수동 확인** (스펙 §검증)

마스터 로그인→과제 생성→간사 배정 / 간사 로그인→배정 과제 하위 분과 생성·구성 / 남의 분과 URL 차단 / 평가위원 채점 정상 / 기존 분과 "미분류" 표시.

- [ ] **Step 4: 커밋 + 푸시**

```bash
git add e2e
git commit -m "test(e2e): 역할 개편 반영(과제 관리 랜딩·간사 흐름)"
git push
```

---

## Self-Review 메모
- **스펙 커버리지**: 모델(T1)·권한(T2)·로그인/게이트(T3)·과제(T4)·분과생성/스코프(T5)·메뉴(T6)·간사계정(T7)·마이그레이션·시드(T1,T8)·검증(T9) — 스펙 각 항목 대응됨. 2차(통합 대시보드·결과관리)는 범위 밖 명시.
- **마이그레이션 위험**: Role enum 재생성은 프로덕션 DB에 적용됨(로컬=prod 동일 DB). `migrate deploy`는 멱등 아님 — 한 번만. 롤백 필요 시 역 SQL 준비(별도).
- **잔여 리스크**: `login-rules.ts`/`session-rules.ts`의 ADMIN 예외, 하드코딩 "관리자" 라벨 — Task 8에서 grep로 정리.
