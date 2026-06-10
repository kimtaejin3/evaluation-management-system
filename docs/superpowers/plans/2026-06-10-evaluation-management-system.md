# 심사·평가 관리 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 심사 항목 설정 → 평가 → 결과 출력·보관의 큰 흐름을 일반화하여 구현하는 Next.js 풀스택 웹앱.

**Architecture:** Next.js(App Router) 단일 프로젝트. 읽기는 Server Component, 쓰기는 Server Action. 집계·검증은 UI/DB와 분리된 순수 함수(`lib/scoring.ts`)로 작성·테스트. 인증은 bcrypt + JWT(httpOnly 쿠키) + middleware. 데이터는 PostgreSQL + Prisma.

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Vitest, bcryptjs, jose, Tailwind CSS.

---

## File Structure

```
prisma/schema.prisma            데이터 모델
prisma/seed.ts                  초기 관리자 시드
lib/db.ts                       Prisma client 싱글톤
lib/scoring.ts                  집계·환산·검증 순수 함수
lib/scoring.test.ts             scoring 단위 테스트
lib/auth.ts                     비밀번호 해시·JWT 발급/검증
lib/auth.test.ts                auth 단위 테스트
lib/session.ts                  현재 로그인 사용자 조회(쿠키)
middleware.ts                   라우트 보호
app/login/page.tsx              로그인 화면
app/login/actions.ts            로그인/로그아웃 server action
app/admin/page.tsx              관리자 대시보드(회차 목록)
app/admin/sessions/new/page.tsx 회차 생성
app/admin/sessions/[id]/page.tsx          회차 상세·상태 전환
app/admin/sessions/[id]/criteria/page.tsx 평가 항목 관리
app/admin/sessions/[id]/subjects/page.tsx 평가 대상 관리
app/admin/sessions/[id]/evaluators/page.tsx 평가위원 배정
app/admin/sessions/[id]/results/page.tsx  집계 결과표
app/admin/sessions/actions.ts   회차/항목/대상/위원 server actions
app/api/sessions/[id]/results.csv/route.ts CSV 다운로드
app/evaluate/page.tsx           평가위원 회차·대상 목록
app/evaluate/[sessionId]/[subjectId]/page.tsx 점수 입력 시트
app/evaluate/actions.ts         점수 저장/제출 server action
app/globals.css                 Tailwind + 인쇄 CSS
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `.gitignore`, `.env`

- [ ] **Step 1: Next.js 프로젝트 생성**

작업 디렉토리(`/Users/kimtaejin/dev/evaluation-management-system`)에 이미 파일이 있으므로 임시 디렉토리에 생성 후 병합한다.

Run:
```bash
npx create-next-app@latest temp-app --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack --use-npm
cp -r temp-app/. .
rm -rf temp-app
```
Expected: `app/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind` 설정 생성됨.

- [ ] **Step 2: 의존성 추가**

Run:
```bash
npm install @prisma/client bcryptjs jose
npm install -D prisma vitest @vitejs/plugin-react bcryptjs @types/bcryptjs
```
Expected: 설치 성공.

- [ ] **Step 3: Vitest 설정 파일 생성**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: package.json 스크립트 추가**

`package.json`의 `"scripts"`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 5: .env 생성**

Create `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eval_system?schema=public"
JWT_SECRET="change-me-in-production-please-32chars-min"
```

- [ ] **Step 6: 앱 실행 확인**

Run: `npm run dev` (백그라운드로 띄운 뒤 `curl -s localhost:3000 | head`)
Expected: 기본 Next.js 페이지 응답. 확인 후 종료.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with deps and test config"
```

---

## Task 2: Prisma 스키마 & 마이그레이션

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`

- [ ] **Step 1: Prisma 초기화**

Run: `npx prisma init --datasource-provider postgresql`
Expected: `prisma/schema.prisma` 생성(`.env`는 이미 존재).

- [ ] **Step 2: 스키마 작성**

Overwrite `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  EVALUATOR
}

enum SessionStatus {
  DRAFT
  IN_PROGRESS
  CLOSED
}

enum CriterionType {
  QUANTITATIVE
  QUALITATIVE
}

model User {
  id           String       @id @default(cuid())
  username     String       @unique
  passwordHash String
  name         String
  role         Role
  assignments  Assignment[]
  scores       Score[]
  createdAt    DateTime     @default(now())
}

model EvaluationSession {
  id          String            @id @default(cuid())
  name        String
  description String?
  eventDate   DateTime?
  location    String?
  status      SessionStatus     @default(DRAFT)
  criteria    Criterion[]
  subjects    Subject[]
  assignments Assignment[]
  scores      Score[]
  createdAt   DateTime          @default(now())
}

model Criterion {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  type        CriterionType
  maxScore    Float
  weight      Float             @default(1)
  order       Int               @default(0)
  scores      Score[]
}

model Subject {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  order       Int               @default(0)
  scores      Score[]
}

model Assignment {
  id        String            @id @default(cuid())
  sessionId String
  session   EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sessionId, userId])
}

model Score {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  evaluatorId String
  evaluator   User              @relation(fields: [evaluatorId], references: [id], onDelete: Cascade)
  subjectId   String
  subject     Subject           @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  criterionId String
  criterion   Criterion         @relation(fields: [criterionId], references: [id], onDelete: Cascade)
  value       Float
  grade       String?
  comment     String?
  updatedAt   DateTime          @updatedAt

  @@unique([evaluatorId, subjectId, criterionId])
}
```

- [ ] **Step 3: DB 준비 & 마이그레이션**

PostgreSQL이 로컬에서 실행 중이어야 한다. 미실행 시:
```bash
docker run -d --name eval-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=eval_system -p 5432:5432 postgres:16
```
Run: `npx prisma migrate dev --name init`
Expected: 마이그레이션 생성·적용, Prisma Client 생성.

- [ ] **Step 4: Prisma client 싱글톤 작성**

Create `lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema and database client"
```

---

## Task 3: 시드 — 초기 관리자

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (tsx 의존성)

- [ ] **Step 1: tsx 설치**

Run: `npm install -D tsx`

- [ ] **Step 2: 시드 스크립트 작성**

Create `prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, name: '관리자', role: 'ADMIN' },
  })
  console.log('Seeded admin (admin / admin1234)')
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 3: 시드 실행**

Run: `npm run db:seed`
Expected: `Seeded admin (admin / admin1234)` 출력.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin seed script"
```

---

## Task 4: 집계·검증 순수 함수 (TDD)

**Files:**
- Create: `lib/scoring.ts`, `lib/scoring.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  GRADE_RATIOS,
  gradeToValue,
  isValidScoreValue,
  computeWeightedScore,
  computeFinalScores,
  rankSubjects,
} from './scoring'

describe('gradeToValue', () => {
  it('A는 만점, E는 20%', () => {
    expect(gradeToValue('A', 10)).toBe(10)
    expect(gradeToValue('E', 10)).toBeCloseTo(2)
  })
  it('알 수 없는 등급은 0', () => {
    expect(gradeToValue('Z', 10)).toBe(0)
  })
})

describe('isValidScoreValue', () => {
  it('0~maxScore 범위만 통과', () => {
    expect(isValidScoreValue(5, 10)).toBe(true)
    expect(isValidScoreValue(0, 10)).toBe(true)
    expect(isValidScoreValue(10, 10)).toBe(true)
    expect(isValidScoreValue(-1, 10)).toBe(false)
    expect(isValidScoreValue(11, 10)).toBe(false)
    expect(isValidScoreValue(NaN, 10)).toBe(false)
  })
})

describe('computeWeightedScore', () => {
  it('value × weight 의 합', () => {
    const criteria = [
      { id: 'c1', weight: 2 },
      { id: 'c2', weight: 1 },
    ]
    const rows = [
      { criterionId: 'c1', value: 5 },
      { criterionId: 'c2', value: 8 },
    ]
    expect(computeWeightedScore(rows, criteria)).toBe(18) // 5*2 + 8*1
  })
  it('누락된 항목은 0으로 취급', () => {
    const criteria = [{ id: 'c1', weight: 1 }, { id: 'c2', weight: 1 }]
    const rows = [{ criterionId: 'c1', value: 5 }]
    expect(computeWeightedScore(rows, criteria)).toBe(5)
  })
})

describe('computeFinalScores', () => {
  it('대상별 위원 평균', () => {
    const criteria = [{ id: 'c1', weight: 1 }]
    const rows = [
      { evaluatorId: 'e1', subjectId: 's1', criterionId: 'c1', value: 6 },
      { evaluatorId: 'e2', subjectId: 's1', criterionId: 'c1', value: 8 },
      { evaluatorId: 'e1', subjectId: 's2', criterionId: 'c1', value: 4 },
    ]
    const result = computeFinalScores(rows, criteria)
    expect(result.get('s1')).toBe(7) // (6+8)/2
    expect(result.get('s2')).toBe(4)
  })
  it('점수 없는 대상은 0', () => {
    const result = computeFinalScores([], [{ id: 'c1', weight: 1 }])
    expect(result.size).toBe(0)
  })
})

describe('rankSubjects', () => {
  it('내림차순 순위, 동점은 동순위', () => {
    const map = new Map([
      ['s1', 90],
      ['s2', 90],
      ['s3', 80],
    ])
    const ranked = rankSubjects(map)
    expect(ranked).toEqual([
      { subjectId: 's1', finalScore: 90, rank: 1 },
      { subjectId: 's2', finalScore: 90, rank: 1 },
      { subjectId: 's3', finalScore: 80, rank: 3 },
    ])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `./scoring` 모듈/함수 없음.

- [ ] **Step 3: 구현 작성**

Create `lib/scoring.ts`:
```ts
export const GRADE_RATIOS: Record<string, number> = {
  A: 1.0,
  B: 0.8,
  C: 0.6,
  D: 0.4,
  E: 0.2,
}

export function gradeToValue(grade: string, maxScore: number): number {
  const ratio = GRADE_RATIOS[grade] ?? 0
  return maxScore * ratio
}

export function isValidScoreValue(value: number, maxScore: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maxScore
}

export interface WeightedCriterion {
  id: string
  weight: number
}

export interface ScoreRow {
  criterionId: string
  value: number
}

export function computeWeightedScore(
  rows: ScoreRow[],
  criteria: WeightedCriterion[],
): number {
  const byId = new Map(rows.map((r) => [r.criterionId, r.value]))
  return criteria.reduce((sum, c) => sum + (byId.get(c.id) ?? 0) * c.weight, 0)
}

export interface FullScoreRow {
  evaluatorId: string
  subjectId: string
  criterionId: string
  value: number
}

export function computeFinalScores(
  rows: FullScoreRow[],
  criteria: WeightedCriterion[],
): Map<string, number> {
  // subjectId -> evaluatorId -> ScoreRow[]
  const grouped = new Map<string, Map<string, ScoreRow[]>>()
  for (const r of rows) {
    if (!grouped.has(r.subjectId)) grouped.set(r.subjectId, new Map())
    const byEval = grouped.get(r.subjectId)!
    if (!byEval.has(r.evaluatorId)) byEval.set(r.evaluatorId, [])
    byEval.get(r.evaluatorId)!.push({ criterionId: r.criterionId, value: r.value })
  }

  const result = new Map<string, number>()
  for (const [subjectId, byEval] of grouped) {
    const perEval = [...byEval.values()].map((scoreRows) =>
      computeWeightedScore(scoreRows, criteria),
    )
    const avg = perEval.reduce((a, b) => a + b, 0) / perEval.length
    result.set(subjectId, avg)
  }
  return result
}

export interface RankedSubject {
  subjectId: string
  finalScore: number
  rank: number
}

export function rankSubjects(scores: Map<string, number>): RankedSubject[] {
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const ranked: RankedSubject[] = []
  sorted.forEach(([subjectId, finalScore], index) => {
    const rank =
      index > 0 && sorted[index - 1][1] === finalScore
        ? ranked[index - 1].rank
        : index + 1
    ranked.push({ subjectId, finalScore, rank })
  })
  return ranked
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 모든 scoring 테스트 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: add scoring and validation pure functions with tests"
```

---

## Task 5: 인증 유틸 (TDD)

**Files:**
- Create: `lib/auth.ts`, `lib/auth.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth'

describe('password hashing', () => {
  it('해시 후 검증 성공/실패', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('jwt', () => {
  it('발급한 토큰을 검증하면 payload 복원', async () => {
    const token = await signToken({ userId: 'u1', role: 'ADMIN' })
    const payload = await verifyToken(token)
    expect(payload?.userId).toBe('u1')
    expect(payload?.role).toBe('ADMIN')
  })
  it('잘못된 토큰은 null', async () => {
    expect(await verifyToken('garbage')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `./auth` 없음. (테스트는 `JWT_SECRET` 환경변수가 필요하므로 `.env`에 이미 존재. Vitest는 `process.env`를 읽으나 `.env` 자동 로드 안 함 → Step 3에서 기본값 처리)

- [ ] **Step 3: 구현 작성**

Create `lib/auth.ts`:
```ts
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

export type Role = 'ADMIN' | 'EVALUATOR'

export interface TokenPayload {
  userId: string
  role: Role
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-key-at-least-32-characters-long',
)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return { userId: payload.userId as string, role: payload.role as Role }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: add password hashing and JWT auth utilities with tests"
```

---

## Task 6: 세션 헬퍼 & 미들웨어

**Files:**
- Create: `lib/session.ts`, `middleware.ts`

- [ ] **Step 1: 현재 사용자 헬퍼 작성**

Create `lib/session.ts`:
```ts
import { cookies } from 'next/headers'
import { verifyToken, type TokenPayload } from './auth'
import { prisma } from './db'

const COOKIE_NAME = 'auth_token'

export async function getCurrentToken(): Promise<TokenPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getCurrentUser() {
  const payload = await getCurrentToken()
  if (!payload) return null
  return prisma.user.findUnique({ where: { id: payload.userId } })
}

export const AUTH_COOKIE = COOKIE_NAME
```

- [ ] **Step 2: 미들웨어 작성**

Create `middleware.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const payload = token ? await verifyToken(token) : null
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role !== 'ADMIN') return NextResponse.redirect(new URL('/evaluate', req.url))
  }
  if (pathname.startsWith('/evaluate')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role !== 'EVALUATOR') return NextResponse.redirect(new URL('/admin', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/evaluate/:path*'],
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add lib/session.ts middleware.ts
git commit -m "feat: add session helper and route-protection middleware"
```

---

## Task 7: 로그인 / 로그아웃

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`
- Modify: `app/page.tsx` (루트 → 역할별 리다이렉트)

- [ ] **Step 1: 로그인 server action 작성**

Create `app/login/actions.ts`:
```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/session'

export async function login(_prev: unknown, formData: FormData) {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  const token = await signToken({ userId: user.id, role: user.role })
  const store = await cookies()
  store.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect(user.role === 'ADMIN' ? '/admin' : '/evaluate')
}

export async function logout() {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect('/login')
}
```

- [ ] **Step 2: 로그인 페이지 작성**

Create `app/login/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form action={formAction} className="w-80 space-y-4 rounded border bg-white p-8 shadow">
        <h1 className="text-xl font-bold">심사·평가 시스템</h1>
        <p className="text-sm text-gray-500">관리자 · 평가위원 로그인</p>
        <div>
          <label className="block text-sm">아이디</label>
          <input name="username" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm">비밀번호</label>
          <input name="password" type="password" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="w-full rounded bg-gray-900 py-2 text-white">로그인</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: 루트 리다이렉트 작성**

Overwrite `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { getCurrentToken } from '@/lib/session'

export default async function Home() {
  const payload = await getCurrentToken()
  if (!payload) redirect('/login')
  redirect(payload.role === 'ADMIN' ? '/admin' : '/evaluate')
}
```

- [ ] **Step 4: 수동 검증**

Run: `npm run dev`, 브라우저에서 `localhost:3000` → `/login` 리다이렉트, `admin`/`admin1234` 로그인 → `/admin` 이동 확인(현재 `/admin`은 미구현이라 404/에러여도 됨 — 리다이렉트만 확인).
Expected: 로그인 성공 시 쿠키 설정 및 `/admin`으로 이동.

- [ ] **Step 5: Commit**

```bash
git add app/login app/page.tsx
git commit -m "feat: add login/logout flow and root redirect"
```

---

## Task 8: 관리자 대시보드 (회차 목록)

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`
- Create: `app/admin/sessions/actions.ts` (회차 생성 액션 포함)

- [ ] **Step 1: 회차 생성 액션 작성**

Create `app/admin/sessions/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export async function createSession(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const session = await prisma.evaluationSession.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      location: String(formData.get('location') ?? '') || null,
      eventDate: formData.get('eventDate') ? new Date(String(formData.get('eventDate'))) : null,
    },
  })
  redirect(`/admin/sessions/${session.id}`)
}

export async function setSessionStatus(sessionId: string, status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED') {
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status } })
  revalidatePath(`/admin/sessions/${sessionId}`)
}
```

- [ ] **Step 2: 관리자 레이아웃 작성**

Create `app/admin/layout.tsx`:
```tsx
import Link from 'next/link'
import { logout } from '@/app/login/actions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/admin" className="font-bold">심사·평가 시스템 · 관리자</Link>
        <form action={logout}><button className="text-sm text-gray-500">로그아웃</button></form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: 대시보드 페이지 작성**

Create `app/admin/page.tsx`:
```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'

const STATUS_LABEL = { DRAFT: '초안', IN_PROGRESS: '진행중', CLOSED: '마감' } as const

export default async function AdminDashboard() {
  const sessions = await prisma.evaluationSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { subjects: true, criteria: true } } },
  })
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">심사 회차</h1>
        <Link href="/admin/sessions/new" className="rounded bg-gray-900 px-4 py-2 text-white">+ 새 회차</Link>
      </div>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">회차명</th><th className="p-2">상태</th><th className="p-2">항목</th><th className="p-2">대상</th></tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2"><Link href={`/admin/sessions/${s.id}`} className="text-blue-600 underline">{s.name}</Link></td>
              <td className="p-2">{STATUS_LABEL[s.status]}</td>
              <td className="p-2">{s._count.criteria}</td>
              <td className="p-2">{s._count.subjects}</td>
            </tr>
          ))}
          {sessions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">회차가 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: 수동 검증**

Run: `npm run dev` → admin 로그인 → `/admin`에서 "회차가 없습니다." 표시 확인.

- [ ] **Step 5: Commit**

```bash
git add app/admin app/admin/sessions/actions.ts
git commit -m "feat: add admin dashboard with session list"
```

---

## Task 9: 회차 생성 화면

**Files:**
- Create: `app/admin/sessions/new/page.tsx`

- [ ] **Step 1: 생성 폼 페이지 작성**

Create `app/admin/sessions/new/page.tsx`:
```tsx
import { createSession } from '../actions'

export default function NewSessionPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">새 회차</h1>
      <form action={createSession} className="space-y-4">
        <div>
          <label className="block text-sm">회차명 *</label>
          <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">설명</label>
          <textarea name="description" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">일시</label>
          <input name="eventDate" type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">장소</label>
          <input name="location" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-gray-900 px-4 py-2 text-white">생성</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 수동 검증**

Run: dev 서버에서 `/admin/sessions/new` → 회차명 입력·생성 → 상세 페이지로 리다이렉트(상세 미구현 시 에러여도 됨), `/admin` 목록에 노출 확인.

- [ ] **Step 3: Commit**

```bash
git add app/admin/sessions/new
git commit -m "feat: add session creation form"
```

---

## Task 10: 회차 상세 & 상태 전환

**Files:**
- Create: `app/admin/sessions/[id]/page.tsx`

- [ ] **Step 1: 상세 페이지 작성**

Create `app/admin/sessions/[id]/page.tsx`:
```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { setSessionStatus } from '../actions'

const STATUS_LABEL = { DRAFT: '초안', IN_PROGRESS: '진행중', CLOSED: '마감' } as const

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({
    where: { id },
    include: { _count: { select: { criteria: true, subjects: true, assignments: true } } },
  })
  if (!session) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-gray-500">상태: {STATUS_LABEL[session.status]}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href={`/admin/sessions/${id}/criteria`} className="rounded border p-4 hover:bg-gray-50">평가 항목 ({session._count.criteria})</Link>
        <Link href={`/admin/sessions/${id}/subjects`} className="rounded border p-4 hover:bg-gray-50">평가 대상 ({session._count.subjects})</Link>
        <Link href={`/admin/sessions/${id}/evaluators`} className="rounded border p-4 hover:bg-gray-50">평가위원 ({session._count.assignments})</Link>
        <Link href={`/admin/sessions/${id}/results`} className="rounded border p-4 hover:bg-gray-50">집계 결과</Link>
      </div>

      <div className="flex gap-2">
        <form action={async () => { 'use server'; await setSessionStatus(id, 'IN_PROGRESS') }}>
          <button disabled={session.status !== 'DRAFT'} className="rounded border px-4 py-2 disabled:opacity-40">평가 시작</button>
        </form>
        <form action={async () => { 'use server'; await setSessionStatus(id, 'CLOSED') }}>
          <button disabled={session.status !== 'IN_PROGRESS'} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40">마감·잠금</button>
        </form>
        <form action={async () => { 'use server'; await setSessionStatus(id, 'DRAFT') }}>
          <button disabled={session.status === 'DRAFT'} className="rounded border px-4 py-2 disabled:opacity-40">초안으로</button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 수동 검증**

Run: 상세 페이지에서 "평가 시작" → 상태 "진행중", "마감·잠금" → "마감" 전환 확인.

- [ ] **Step 3: Commit**

```bash
git add app/admin/sessions/[id]/page.tsx
git commit -m "feat: add session detail with status transitions"
```

---

## Task 11: 평가 항목 관리 (CRUD)

**Files:**
- Create: `app/admin/sessions/[id]/criteria/page.tsx`
- Modify: `app/admin/sessions/actions.ts` (항목 액션 추가)

- [ ] **Step 1: 항목 액션 추가**

Append to `app/admin/sessions/actions.ts`:
```ts
export async function addCriterion(sessionId: string, formData: FormData) {
  const count = await prisma.criterion.count({ where: { sessionId } })
  await prisma.criterion.create({
    data: {
      sessionId,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '') || null,
      type: String(formData.get('type')) === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE',
      maxScore: Number(formData.get('maxScore') ?? 0),
      weight: Number(formData.get('weight') ?? 1),
      order: count,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function deleteCriterion(sessionId: string, criterionId: string) {
  await prisma.criterion.delete({ where: { id: criterionId } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}
```

- [ ] **Step 2: 항목 관리 페이지 작성**

Create `app/admin/sessions/[id]/criteria/page.tsx`:
```tsx
import { prisma } from '@/lib/db'
import { addCriterion, deleteCriterion } from '../../actions'

const TYPE_LABEL = { QUANTITATIVE: '정량', QUALITATIVE: '정성' } as const

export default async function CriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가 항목 관리</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">항목명</th><th className="p-2">방식</th><th className="p-2">배점</th><th className="p-2">가중치</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{c.name}<div className="text-xs text-gray-400">{c.description}</div></td>
              <td className="p-2">{TYPE_LABEL[c.type]}</td>
              <td className="p-2">{c.maxScore}</td>
              <td className="p-2">{c.weight}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await deleteCriterion(id, c.id) }}>
                  <button disabled={locked} className="text-red-600 disabled:opacity-30">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!locked && (
        <form action={addCriterion.bind(null, id)} className="grid grid-cols-2 gap-3 rounded border p-4">
          <input name="name" placeholder="항목명" required className="rounded border px-3 py-2" />
          <select name="type" className="rounded border px-3 py-2">
            <option value="QUANTITATIVE">정량 (점수 직접 입력)</option>
            <option value="QUALITATIVE">정성 (등급 선택)</option>
          </select>
          <input name="maxScore" type="number" step="any" placeholder="배점" required className="rounded border px-3 py-2" />
          <input name="weight" type="number" step="any" defaultValue={1} placeholder="가중치" className="rounded border px-3 py-2" />
          <input name="description" placeholder="설명(선택)" className="col-span-2 rounded border px-3 py-2" />
          <button className="col-span-2 rounded bg-gray-900 py-2 text-white">+ 항목 추가</button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 수동 검증**

Run: 항목 추가(정량/정성 각 1개) → 목록 표시, 삭제 동작, CLOSED 상태에서 추가/삭제 버튼 비활성 확인.

- [ ] **Step 4: Commit**

```bash
git add app/admin/sessions/[id]/criteria app/admin/sessions/actions.ts
git commit -m "feat: add criteria management (add/list/delete)"
```

---

## Task 12: 평가 대상 관리 (CRUD)

**Files:**
- Create: `app/admin/sessions/[id]/subjects/page.tsx`
- Modify: `app/admin/sessions/actions.ts` (대상 액션 추가)

- [ ] **Step 1: 대상 액션 추가**

Append to `app/admin/sessions/actions.ts`:
```ts
export async function addSubject(sessionId: string, formData: FormData) {
  const count = await prisma.subject.count({ where: { sessionId } })
  await prisma.subject.create({
    data: {
      sessionId,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '') || null,
      order: count,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteSubject(sessionId: string, subjectId: string) {
  await prisma.subject.delete({ where: { id: subjectId } })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}
```

- [ ] **Step 2: 대상 관리 페이지 작성**

Create `app/admin/sessions/[id]/subjects/page.tsx`:
```tsx
import { prisma } from '@/lib/db'
import { addSubject, deleteSubject } from '../../actions'

export default async function SubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' } })
  const locked = session?.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가 대상 관리</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">#</th><th className="p-2">대상명</th><th className="p-2">설명</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{i + 1}</td>
              <td className="p-2">{s.name}</td>
              <td className="p-2 text-gray-500">{s.description}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await deleteSubject(id, s.id) }}>
                  <button disabled={locked} className="text-red-600 disabled:opacity-30">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!locked && (
        <form action={addSubject.bind(null, id)} className="grid grid-cols-2 gap-3 rounded border p-4">
          <input name="name" placeholder="대상명" required className="rounded border px-3 py-2" />
          <input name="description" placeholder="설명(선택)" className="rounded border px-3 py-2" />
          <button className="col-span-2 rounded bg-gray-900 py-2 text-white">+ 대상 추가</button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 수동 검증**

Run: 대상 추가/삭제 동작, CLOSED 시 비활성 확인.

- [ ] **Step 4: Commit**

```bash
git add app/admin/sessions/[id]/subjects app/admin/sessions/actions.ts
git commit -m "feat: add subject management (add/list/delete)"
```

---

## Task 13: 평가위원 배정 (계정 생성 + 매핑)

**Files:**
- Create: `app/admin/sessions/[id]/evaluators/page.tsx`
- Modify: `app/admin/sessions/actions.ts` (위원 액션 추가)

- [ ] **Step 1: 위원 액션 추가**

Append to `app/admin/sessions/actions.ts` (상단 import에 `hashPassword` 추가 필요):
```ts
import { hashPassword } from '@/lib/auth'

export async function addEvaluator(sessionId: string, formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !name || !password) return

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, name, role: 'EVALUATOR', passwordHash: await hashPassword(password) },
  })
  await prisma.assignment.upsert({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    update: {},
    create: { sessionId, userId: user.id },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

export async function removeEvaluator(sessionId: string, userId: string) {
  await prisma.assignment.delete({ where: { sessionId_userId: { sessionId, userId } } })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}
```

- [ ] **Step 2: 위원 배정 페이지 작성**

Create `app/admin/sessions/[id]/evaluators/page.tsx`:
```tsx
import { prisma } from '@/lib/db'
import { addEvaluator, removeEvaluator } from '../../actions'

export default async function EvaluatorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignments = await prisma.assignment.findMany({
    where: { sessionId: id },
    include: { user: true },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">평가위원 배정</h1>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">이름</th><th className="p-2">아이디</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-2">{a.user.name}</td>
              <td className="p-2">{a.user.username}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await removeEvaluator(id, a.userId) }}>
                  <button className="text-red-600">배정 해제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={addEvaluator.bind(null, id)} className="grid grid-cols-3 gap-3 rounded border p-4">
        <input name="name" placeholder="이름" required className="rounded border px-3 py-2" />
        <input name="username" placeholder="아이디" required className="rounded border px-3 py-2" />
        <input name="password" placeholder="임시 비밀번호" required className="rounded border px-3 py-2" />
        <button className="col-span-3 rounded bg-gray-900 py-2 text-white">+ 위원 추가·배정</button>
      </form>
      <p className="text-xs text-gray-400">기존 아이디면 계정을 재사용하고 이 회차에 배정만 추가합니다.</p>
    </div>
  )
}
```

- [ ] **Step 3: 수동 검증**

Run: 위원 추가 → 목록 표시, 배정 해제 동작 확인. 추가한 위원 계정으로 로그아웃 후 로그인 → `/evaluate` 이동 확인.

- [ ] **Step 4: Commit**

```bash
git add app/admin/sessions/[id]/evaluators app/admin/sessions/actions.ts
git commit -m "feat: add evaluator account creation and assignment"
```

---

## Task 14: 평가위원 회차·대상 목록

**Files:**
- Create: `app/evaluate/layout.tsx`, `app/evaluate/page.tsx`

- [ ] **Step 1: 평가위원 레이아웃 작성**

Create `app/evaluate/layout.tsx`:
```tsx
import Link from 'next/link'
import { logout } from '@/app/login/actions'

export default function EvaluateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/evaluate" className="font-bold">심사·평가 시스템 · 평가위원</Link>
        <form action={logout}><button className="text-sm text-gray-500">로그아웃</button></form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: 평가위원 목록 페이지 작성**

Create `app/evaluate/page.tsx`:
```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export default async function EvaluateHome() {
  const user = await getCurrentUser()
  if (!user) return null

  const assignments = await prisma.assignment.findMany({
    where: { userId: user.id, session: { status: 'IN_PROGRESS' } },
    include: {
      session: { include: { subjects: { orderBy: { order: 'asc' } }, criteria: true } },
    },
  })

  // 평가위원이 이미 입력한 점수 수 조회 (대상별 완료 판단)
  const myScores = await prisma.score.findMany({ where: { evaluatorId: user.id }, select: { subjectId: true, criterionId: true } })
  const doneByCriterion = new Set(myScores.map((s) => `${s.subjectId}:${s.criterionId}`))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">평가 대상</h1>
      {assignments.length === 0 && <p className="text-gray-400">진행 중인 배정 회차가 없습니다.</p>}
      {assignments.map((a) => (
        <section key={a.id} className="space-y-3">
          <h2 className="font-semibold">{a.session.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.session.subjects.map((sub) => {
              const total = a.session.criteria.length
              const done = a.session.criteria.filter((c) => doneByCriterion.has(`${sub.id}:${c.id}`)).length
              const complete = total > 0 && done === total
              return (
                <Link key={sub.id} href={`/evaluate/${a.session.id}/${sub.id}`} className="rounded border p-4 hover:bg-gray-50">
                  <div className="font-medium">{sub.name}</div>
                  <div className={`text-sm ${complete ? 'text-green-600' : 'text-gray-400'}`}>
                    {complete ? '입력 완료' : `${done}/${total} 입력`}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 수동 검증**

Run: 위원 로그인 → 진행중(IN_PROGRESS) 회차의 대상 카드 목록 표시 확인. (회차를 IN_PROGRESS로 전환해 두어야 함)

- [ ] **Step 4: Commit**

```bash
git add app/evaluate/layout.tsx app/evaluate/page.tsx
git commit -m "feat: add evaluator session and subject list"
```

---

## Task 15: 점수 입력 시트

**Files:**
- Create: `app/evaluate/[sessionId]/[subjectId]/page.tsx`, `app/evaluate/actions.ts`

- [ ] **Step 1: 점수 저장 액션 작성**

Create `app/evaluate/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { isValidScoreValue, gradeToValue } from '@/lib/scoring'

export async function saveScores(sessionId: string, subjectId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'IN_PROGRESS') {
    return { error: '진행 중인 회차에서만 입력할 수 있습니다.' }
  }

  // 배정 확인
  const assigned = await prisma.assignment.findUnique({
    where: { sessionId_userId: { sessionId, userId: user.id } },
  })
  if (!assigned) return { error: '배정되지 않은 회차입니다.' }

  const criteria = await prisma.criterion.findMany({ where: { sessionId } })

  for (const c of criteria) {
    const raw = formData.get(`c_${c.id}`)
    if (raw === null || raw === '') return { error: `'${c.name}' 항목이 입력되지 않았습니다.` }

    let value: number
    let grade: string | null = null
    if (c.type === 'QUALITATIVE') {
      grade = String(raw)
      value = gradeToValue(grade, c.maxScore)
    } else {
      value = Number(raw)
      if (!isValidScoreValue(value, c.maxScore)) {
        return { error: `'${c.name}'은 0~${c.maxScore} 범위로 입력하세요.` }
      }
    }

    await prisma.score.upsert({
      where: { evaluatorId_subjectId_criterionId: { evaluatorId: user.id, subjectId, criterionId: c.id } },
      update: { value, grade, sessionId },
      create: { evaluatorId: user.id, subjectId, criterionId: c.id, sessionId, value, grade },
    })
  }

  redirect('/evaluate')
}
```

- [ ] **Step 2: 점수 입력 페이지 작성**

Create `app/evaluate/[sessionId]/[subjectId]/page.tsx`:
```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { GRADE_RATIOS } from '@/lib/scoring'
import { saveScores } from '@/app/evaluate/actions'

export default async function ScoreSheet({ params }: { params: Promise<{ sessionId: string; subjectId: string }> }) {
  const { sessionId, subjectId } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
  if (!subject) notFound()

  const existing = await prisma.score.findMany({
    where: { evaluatorId: user.id, subjectId },
  })
  const byCriterion = new Map(existing.map((s) => [s.criterionId, s]))
  const grades = Object.keys(GRADE_RATIOS)

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/evaluate" className="text-sm text-blue-600">← 대상 목록</Link>
      <h1 className="text-2xl font-bold">{subject.name}</h1>
      <form action={saveScores.bind(null, sessionId, subjectId)} className="space-y-4">
        {criteria.map((c) => {
          const cur = byCriterion.get(c.id)
          return (
            <div key={c.id} className="rounded border p-4">
              <div className="font-medium">{c.name} <span className="text-sm text-gray-400">(배점 {c.maxScore} · 가중치 {c.weight})</span></div>
              {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
              {c.type === 'QUALITATIVE' ? (
                <select name={`c_${c.id}`} defaultValue={cur?.grade ?? ''} required className="mt-2 rounded border px-3 py-2">
                  <option value="" disabled>등급 선택</option>
                  {grades.map((g) => <option key={g} value={g}>{g} ({Math.round(GRADE_RATIOS[g] * 100)}%)</option>)}
                </select>
              ) : (
                <input name={`c_${c.id}`} type="number" step="any" min={0} max={c.maxScore} defaultValue={cur ? cur.value : ''} required className="mt-2 w-32 rounded border px-3 py-2" />
              )}
            </div>
          )
        })}
        <button className="rounded bg-gray-900 px-6 py-2 text-white">저장·제출</button>
      </form>
    </div>
  )
}
```

> 참고: `saveScores`는 검증 실패 시 `{ error }`를 반환한다. 본 페이지는 server action을 직접 `action`으로 사용하므로 에러 표시가 필요하면 `useActionState` 기반 client wrapper로 확장 가능(MVP에서는 redirect/throw 동작으로 충분). 검증 통과 시 `/evaluate`로 이동한다.

- [ ] **Step 3: 수동 검증**

Run: 위원으로 대상 선택 → 정량 숫자/정성 등급 입력 → 저장 → 목록에서 "입력 완료" 표시. 배점 초과 입력 시 저장 차단 확인.

- [ ] **Step 4: Commit**

```bash
git add app/evaluate/[sessionId] app/evaluate/actions.ts
git commit -m "feat: add score input sheet with validation"
```

---

## Task 16: 집계 결과표

**Files:**
- Create: `app/admin/sessions/[id]/results/page.tsx`

- [ ] **Step 1: 결과 페이지 작성**

Create `app/admin/sessions/[id]/results/page.tsx`:
```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await prisma.evaluationSession.findUnique({ where: { id } })
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } })
  const scores = await prisma.score.findMany({ where: { sessionId: id } })

  const finalScores = computeFinalScores(
    scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  )
  const ranked = rankSubjects(finalScores)
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">집계 결과 · {session?.name}</h1>
        <div className="flex gap-2">
          <a href={`/api/sessions/${id}/results.csv`} className="rounded border px-4 py-2">CSV 다운로드</a>
          <Link href="#" onClick={() => {}} className="rounded bg-gray-900 px-4 py-2 text-white">인쇄</Link>
        </div>
      </div>
      <table className="w-full border text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">순위</th><th className="p-2">대상</th><th className="p-2">최종 점수</th></tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.subjectId} className="border-t">
              <td className="p-2">{r.rank}</td>
              <td className="p-2">{subjectName.get(r.subjectId)}</td>
              <td className="p-2 font-semibold">{r.finalScore.toFixed(2)}</td>
            </tr>
          ))}
          {ranked.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">집계할 점수가 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
```

> 참고: 인쇄 버튼은 Step 2(Task 17)에서 client 컴포넌트로 `window.print()` 연결. 여기서는 placeholder 링크 대신 Task 17에서 교체한다.

- [ ] **Step 2: 수동 검증**

Run: 점수가 입력된 회차의 `/admin/sessions/[id]/results` → 순위·최종 점수 표시 확인.

- [ ] **Step 3: Commit**

```bash
git add app/admin/sessions/[id]/results
git commit -m "feat: add aggregated results table"
```

---

## Task 17: CSV 출력 & 인쇄

**Files:**
- Create: `app/api/sessions/[id]/results.csv/route.ts`, `app/admin/sessions/[id]/results/PrintButton.tsx`
- Modify: `app/admin/sessions/[id]/results/page.tsx` (인쇄 버튼 교체), `app/globals.css` (인쇄 CSS)

- [ ] **Step 1: CSV 라우트 작성**

Create `app/api/sessions/[id]/results.csv/route.ts`:
```ts
import { prisma } from '@/lib/db'
import { computeFinalScores, rankSubjects } from '@/lib/scoring'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const subjects = await prisma.subject.findMany({ where: { sessionId: id } })
  const criteria = await prisma.criterion.findMany({ where: { sessionId: id } })
  const scores = await prisma.score.findMany({ where: { sessionId: id } })

  const finalScores = computeFinalScores(
    scores.map((s) => ({ evaluatorId: s.evaluatorId, subjectId: s.subjectId, criterionId: s.criterionId, value: s.value })),
    criteria.map((c) => ({ id: c.id, weight: c.weight })),
  )
  const ranked = rankSubjects(finalScores)
  const nameById = new Map(subjects.map((s) => [s.id, s.name]))

  const rows = [['순위', '대상', '최종점수'], ...ranked.map((r) => [String(r.rank), nameById.get(r.subjectId) ?? '', r.finalScore.toFixed(2)])]
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="results-${id}.csv"`,
    },
  })
}
```

- [ ] **Step 2: 인쇄 버튼 컴포넌트 작성**

Create `app/admin/sessions/[id]/results/PrintButton.tsx`:
```tsx
'use client'
export default function PrintButton() {
  return <button onClick={() => window.print()} className="rounded bg-gray-900 px-4 py-2 text-white">인쇄</button>
}
```

- [ ] **Step 3: 결과 페이지에서 인쇄 버튼 교체**

In `app/admin/sessions/[id]/results/page.tsx`:
- 상단 import에 추가: `import PrintButton from './PrintButton'`
- 기존 `<Link href="#" ...>인쇄</Link>` 줄을 `<PrintButton />`으로 교체.

- [ ] **Step 4: 인쇄 CSS 추가**

Append to `app/globals.css`:
```css
@media print {
  header, .print\:hidden { display: none !important; }
  body { background: white; }
}
```

- [ ] **Step 5: 수동 검증**

Run: 결과 페이지에서 "CSV 다운로드" → 한글 깨짐 없는 CSV 받기, "인쇄" → 헤더/버튼 숨겨진 인쇄 미리보기 확인.

- [ ] **Step 6: Commit**

```bash
git add app/api app/admin/sessions/[id]/results app/globals.css
git commit -m "feat: add CSV export and print output"
```

---

## Task 18: 최종 점검

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: scoring·auth 테스트 전부 PASS.

- [ ] **Step 2: 타입 체크 & 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: 엔드투엔드 수동 시나리오**

1. admin 로그인 → 회차 생성
2. 평가 항목(정량 1 + 정성 1) 추가, 대상 2개 추가, 평가위원 2명 추가
3. 회차 "평가 시작"(IN_PROGRESS)
4. 위원 A·B 로그인 → 각 대상 점수 입력·제출
5. admin → 결과 페이지에서 순위·점수 확인, CSV 다운로드
6. 회차 "마감·잠금" → 위원이 점수 수정 시도 시 차단 확인

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final verification pass"
```

---

## Self-Review 메모

- **Spec 커버리지**: 회차 설정(Task 9,10), 항목 가중치+정량/정성(Task 11,4), 대상(Task 12), 위원 배정+권한분리(Task 13,6,7), 점수 입력+검증(Task 15,4), 마감·잠금(Task 10,15), 집계(Task 16,4), 출력 인쇄/CSV(Task 17) — 모두 매핑됨.
- **타입 일관성**: `computeFinalScores`/`rankSubjects` 시그니처가 Task 4 정의와 Task 16·17 호출에서 일치. `AUTH_COOKIE` 상수 Task 6·7 일치. `gradeToValue`/`isValidScoreValue` Task 4·15 일치.
- **범위 밖**(spec 11절): 열람 전용 역할, PDF, 서명, 폐쇄망 인증, 서류 업로드 — 의도적으로 미포함.
