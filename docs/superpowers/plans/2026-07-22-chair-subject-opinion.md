# 위원장 대상별 종합의견 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종합의견 작성을 위원장 전용으로 좁히고, 위원장이 평가 대상별로 위원들의 점수·항목별 의견·제출 유무를 보며 종합의견을 쓰는 화면을 만든다.

**Architecture:** `Opinion` 테이블의 의미만 "위원장이 쓴 대상별 종합의견"으로 좁힌다(스키마 변경 없음). 새 화면은 기존 `/evaluate` 영역의 풀 CSR 패턴을 그대로 따른다 — 얇은 서버 페이지 → 클라이언트 컴포넌트 → `/api/evaluate/*` → `lib/evaluate-data.ts`. 점수 상태·이웃 대상 계산 같은 순수 로직은 `lib/chair-subject.ts`로 분리해 vitest로 덮는다.

**Tech Stack:** Next.js 16 App Router (풀 CSR 구간), React 19, Prisma, Tailwind v4, vitest, Playwright

## Global Constraints

- 스키마(`prisma/schema.prisma`) 변경 금지. `Opinion` 테이블·컬럼 그대로 사용한다.
- 파괴적 마이그레이션 금지. `EvaluationSession.chairSummary` 컬럼과 기존 비위원장 `Opinion` 행은 **삭제하지 않는다**.
- 관리자·간사 화면은 건드리지 않는다. 단 하나의 예외는 `app/admin/sessions/[id]/results/page.tsx`의 분과 총괄평가 표시 블록 제거(Task 7).
- `Opinion`에 쓰는 경로는 최종적으로 `saveChairOpinion` 하나만 남아야 한다.
- 권한 규칙: `session.chairId === user.id`가 아니면 데이터도 주지 않고(403) 저장도 거부한다.
- 잠금 규칙: 분과 `status === 'CLOSED'`면 종합의견은 읽기 전용이고 서버에서도 저장을 거부한다.
- 제출 판정: `Submission.status`가 `SUBMITTED` 또는 `APPROVED`일 때만 제출로 본다.
- 대상 정렬은 `Subject.order` 오름차순을 따른다(이름순 아님).
- 상태 문구는 프로젝트 관례를 따른다 — 제출은 검정(`text-slate-900`), 미제출은 빨강(`text-rose-600`).
- 각 Task 마지막에 `npm run build`가 통과해야 한다.

---

### Task 1: 순수 계산 헬퍼 (`lib/chair-subject.ts`)

DB에 의존하지 않는 계산만 분리한다. 이 저장소의 `lib/*.test.ts`는 전부 순수 함수 단위 테스트이므로, 테스트 가능한 형태로 먼저 만든다.

**Files:**
- Create: `lib/chair-subject.ts`
- Test: `lib/chair-subject.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type ChairEvalState = 'none' | 'partial' | 'complete'`
  - `chairEvalState(filledUnits: number, totalUnits: number): ChairEvalState`
  - `isSubmitted(status: string | null | undefined): boolean`
  - `neighborSubjects(ids: string[], currentId: string): { prevSubjectId: string | null; nextSubjectId: string | null }`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/chair-subject.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chairEvalState, isSubmitted, neighborSubjects } from './chair-subject'

describe('chairEvalState', () => {
  it('전 채점 단위를 입력하면 complete', () => {
    expect(chairEvalState(5, 5)).toBe('complete')
  })
  it('입력 수가 단위 수를 넘어도 complete', () => {
    expect(chairEvalState(6, 5)).toBe('complete')
  })
  it('일부만 입력하면 partial', () => {
    expect(chairEvalState(2, 5)).toBe('partial')
  })
  it('하나도 입력 안 하면 none', () => {
    expect(chairEvalState(0, 5)).toBe('none')
  })
  it('채점 단위가 0개면 입력이 없을 때 none', () => {
    expect(chairEvalState(0, 0)).toBe('none')
  })
})

describe('isSubmitted', () => {
  it('SUBMITTED는 제출', () => {
    expect(isSubmitted('SUBMITTED')).toBe(true)
  })
  it('APPROVED는 제출', () => {
    expect(isSubmitted('APPROVED')).toBe(true)
  })
  it('DRAFT는 미제출', () => {
    expect(isSubmitted('DRAFT')).toBe(false)
  })
  it('REJECTED는 미제출(재작성 상태)', () => {
    expect(isSubmitted('REJECTED')).toBe(false)
  })
  it('기록 없음(null/undefined)은 미제출', () => {
    expect(isSubmitted(null)).toBe(false)
    expect(isSubmitted(undefined)).toBe(false)
  })
})

describe('neighborSubjects', () => {
  const ids = ['a', 'b', 'c']
  it('가운데 대상은 앞뒤 모두 있음', () => {
    expect(neighborSubjects(ids, 'b')).toEqual({ prevSubjectId: 'a', nextSubjectId: 'c' })
  })
  it('첫 대상은 이전이 null', () => {
    expect(neighborSubjects(ids, 'a')).toEqual({ prevSubjectId: null, nextSubjectId: 'b' })
  })
  it('마지막 대상은 다음이 null', () => {
    expect(neighborSubjects(ids, 'c')).toEqual({ prevSubjectId: 'b', nextSubjectId: null })
  })
  it('목록에 없는 대상은 둘 다 null', () => {
    expect(neighborSubjects(ids, 'z')).toEqual({ prevSubjectId: null, nextSubjectId: null })
  })
  it('대상이 하나뿐이면 둘 다 null', () => {
    expect(neighborSubjects(['only'], 'only')).toEqual({ prevSubjectId: null, nextSubjectId: null })
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/chair-subject.test.ts`
Expected: FAIL — `Failed to resolve import "./chair-subject"`

- [ ] **Step 3: 구현 작성**

`lib/chair-subject.ts`:

```ts
// 위원장 대상별 화면의 순수 계산 — DB 접근 없이 테스트 가능한 로직만 모은다.

export type ChairEvalState = 'none' | 'partial' | 'complete'

// 입력 상태 — 전 채점 단위를 입력했을 때만 complete, 일부면 partial, 없으면 none.
// 채점 단위가 0개인 분과에서는 complete가 될 수 없다(집계할 것이 없음).
export function chairEvalState(filledUnits: number, totalUnits: number): ChairEvalState {
  if (totalUnits > 0 && filledUnits >= totalUnits) return 'complete'
  return filledUnits > 0 ? 'partial' : 'none'
}

// 제출 여부 — 제출(SUBMITTED)·승인(APPROVED)만 제출로 본다.
// 반려(REJECTED)는 위원이 다시 작성하는 상태라 미제출로 취급한다.
export function isSubmitted(status: string | null | undefined): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

// 정렬된 대상 id 목록에서 현재 대상의 앞뒤 대상 id
export function neighborSubjects(
  ids: string[],
  currentId: string,
): { prevSubjectId: string | null; nextSubjectId: string | null } {
  const i = ids.indexOf(currentId)
  if (i === -1) return { prevSubjectId: null, nextSubjectId: null }
  return {
    prevSubjectId: i > 0 ? ids[i - 1] : null,
    nextSubjectId: i < ids.length - 1 ? ids[i + 1] : null,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/chair-subject.test.ts`
Expected: PASS — 15 tests passed

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 기존 159개 + 신규 15개 모두 통과, `✓ Compiled successfully`

- [ ] **Step 6: 커밋**

```bash
git add lib/chair-subject.ts lib/chair-subject.test.ts
git commit -m "feat(evaluate): 위원장 대상별 화면 순수 계산 헬퍼 추가"
```

---

### Task 2: 데이터 조회 (`getChairSubjectData`) + API 라우트

**Files:**
- Modify: `lib/evaluate-data.ts` (파일 끝에 추가)
- Create: `app/api/evaluate/chair/subject/route.ts`

**Interfaces:**
- Consumes: `chairEvalState`, `isSubmitted`, `neighborSubjects` (Task 1)
- Produces:
  - `interface ChairSubjectEvaluator { id: string; name: string; isChair: boolean; total: number | null; state: ChairEvalState; groupComments: { groupName: string; text: string }[]; submitted: boolean }`
  - `interface ChairSubjectData { sessionName: string; subjectId: string; subjectName: string; evaluators: ChairSubjectEvaluator[]; chairOpinion: string; locked: boolean; prevSubjectId: string | null; nextSubjectId: string | null }`
  - `getChairSubjectData(userId: string, sessionId: string, subjectId: string): Promise<ChairSubjectData | null>`
  - `GET /api/evaluate/chair/subject?sessionId=&subjectId=`

- [ ] **Step 1: `lib/evaluate-data.ts` 상단 import에 Task 1 헬퍼 추가**

파일 맨 위 import 블록(현재 5줄)에 한 줄 추가한다:

```ts
import { chairEvalState, isSubmitted, neighborSubjects, type ChairEvalState } from '@/lib/chair-subject'
```

- [ ] **Step 2: `lib/evaluate-data.ts` 맨 끝에 타입과 조회 함수 추가**

```ts
// ── 위원장 대상별 상세 ──
export interface ChairSubjectEvaluator {
  id: string
  name: string
  isChair: boolean
  /** 전 채점 단위 입력 완료 시 합계, 아니면 null */
  total: number | null
  state: ChairEvalState
  /** 평가항목(그룹)별 의견 — 작성된 것만 */
  groupComments: { groupName: string; text: string }[]
  submitted: boolean
}

export interface ChairSubjectData {
  sessionName: string
  subjectId: string
  subjectName: string
  evaluators: ChairSubjectEvaluator[]
  /** 위원장이 이 대상에 저장해 둔 종합의견 */
  chairOpinion: string
  /** 분과 마감 시 읽기 전용 */
  locked: boolean
  prevSubjectId: string | null
  nextSubjectId: string | null
}

// 위원장 본인만 접근 가능 — 아니면 null(라우트에서 403)
export async function getChairSubjectData(
  userId: string,
  sessionId: string,
  subjectId: string,
): Promise<ChairSubjectData | null> {
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId } })
  if (!session || session.chairId !== userId) return null
  const chairId = session.chairId

  // 평가항목은 과제(Project) 단위 공통 — 채점 단위(unit) 기준으로 집계
  const criteriaWhere = await criteriaScopeForSession(sessionId)
  const [subjects, units, assignments, scores, groupComments, submissions, chairOpinionRow] = await Promise.all([
    prisma.subject.findMany({ where: { sessionId }, orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    scoringUnitsForScope(criteriaWhere),
    prisma.assignment.findMany({ where: { sessionId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.score.findMany({
      where: { sessionId, subjectId },
      select: { evaluatorId: true, criterionId: true, subitemId: true, value: true },
    }),
    prisma.groupComment.findMany({
      where: { sessionId, subjectId },
      select: { evaluatorId: true, groupId: true, text: true },
    }),
    prisma.submission.findMany({ where: { sessionId, subjectId }, select: { evaluatorId: true, status: true } }),
    prisma.opinion.findUnique({
      where: { evaluatorId_subjectId: { evaluatorId: chairId, subjectId } },
      select: { text: true },
    }),
  ])

  const subject = subjects.find((s) => s.id === subjectId)
  if (!subject) return null

  const weights = units.map((u) => ({ id: u.unitId, weight: u.weight }))
  const totalUnits = units.length

  const rowsOf = new Map<string, { criterionId: string; value: number }[]>()
  for (const s of scores) {
    if (!rowsOf.has(s.evaluatorId)) rowsOf.set(s.evaluatorId, [])
    rowsOf.get(s.evaluatorId)!.push({ criterionId: scoreUnitId(s), value: s.value })
  }
  const commentOf = new Map<string, string>()
  for (const gc of groupComments) commentOf.set(`${gc.evaluatorId}:${gc.groupId}`, gc.text)
  const statusOf = new Map<string, string>()
  for (const sub of submissions) statusOf.set(sub.evaluatorId, sub.status)

  // 평가항목(그룹) 표시 순서는 채점 단위 순서에서 유도
  const orderedGroups: { id: string; name: string }[] = []
  for (const u of units) if (!orderedGroups.some((g) => g.id === u.groupId)) orderedGroups.push({ id: u.groupId, name: u.groupName })

  // 위원장을 맨 앞에
  const ordered = [...assignments].sort((a, b) => (b.userId === chairId ? 1 : 0) - (a.userId === chairId ? 1 : 0))

  return {
    sessionName: session.name,
    subjectId,
    subjectName: subject.name,
    locked: session.status === 'CLOSED',
    chairOpinion: chairOpinionRow?.text ?? '',
    ...neighborSubjects(subjects.map((s) => s.id), subjectId),
    evaluators: ordered.map((a) => {
      const rows = rowsOf.get(a.userId) ?? []
      const state = chairEvalState(rows.length, totalUnits)
      return {
        id: a.userId,
        name: a.user.name,
        isChair: a.userId === chairId,
        state,
        total: state === 'complete' ? computeWeightedScore(rows, weights) : null,
        groupComments: orderedGroups.flatMap((g) => {
          const text = commentOf.get(`${a.userId}:${g.id}`)
          return text ? [{ groupName: g.name, text }] : []
        }),
        submitted: isSubmitted(statusOf.get(a.userId)),
      }
    }),
  }
}
```

- [ ] **Step 3: API 라우트 작성**

`app/api/evaluate/chair/subject/route.ts`:

```ts
import { getCurrentUser } from '@/lib/session'
import { getChairSubjectData } from '@/lib/evaluate-data'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const subjectId = searchParams.get('subjectId')
  if (!sessionId || !subjectId) return new Response('Bad request', { status: 400 })
  const data = await getChairSubjectData(user.id, sessionId, subjectId)
  if (!data) return new Response('Forbidden', { status: 403 })
  return Response.json(data)
}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 라이브 확인 (위원장 계정으로 API 직접 호출)**

`scripts/.verify-chair-subject.tmp.ts`를 만들어 실행한다. 위원장이 지정된 분과와 그 분과의 첫 대상을 찾아 API 응답을 찍는다.

```ts
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

async function main() {
  const s = await prisma.evaluationSession.findFirst({
    where: { chairId: { not: null }, subjects: { some: {} } },
    select: { id: true, chairId: true, subjects: { select: { id: true, name: true }, orderBy: { order: 'asc' }, take: 1 } },
  })
  if (!s) { console.log('위원장 지정 + 대상 보유 분과 없음'); return }
  const token = await signToken({ userId: s.chairId!, role: 'EVALUATOR' })
  const url = `http://localhost:3000/api/evaluate/chair/subject?sessionId=${s.id}&subjectId=${s.subjects[0].id}`
  const res = await fetch(url, { headers: { cookie: `auth_token=${token}` } })
  console.log('status:', res.status)
  console.log(JSON.stringify(await res.json(), null, 2))
  await prisma.$disconnect()
}
main()
```

Run: `npx tsx scripts/.verify-chair-subject.tmp.ts && rm -f scripts/.verify-chair-subject.tmp.ts`
Expected: `status: 200`, 그리고 `evaluators` 배열에 위원별 `name`/`state`/`total`/`submitted`가 채워진 JSON. 임시 스크립트는 실행 직후 삭제한다.

- [ ] **Step 6: 커밋**

```bash
git add lib/evaluate-data.ts app/api/evaluate/chair/subject/route.ts
git commit -m "feat(evaluate): 위원장 대상별 데이터 조회 + API 라우트"
```

---

### Task 3: 종합의견 저장 액션 (`saveChairOpinion`)

**Files:**
- Modify: `app/evaluate/actions.ts` (기존 `saveChairSummary` 바로 아래에 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `saveChairOpinion(sessionId: string, subjectId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>` — formData 키는 `opinion`

- [ ] **Step 1: 액션 추가**

`app/evaluate/actions.ts`의 `saveChairSummary` 함수 바로 아래에 붙인다:

```ts
// 위원장 대상별 종합의견 저장 — 위원장 본인만, 마감 분과는 거부.
// Opinion 테이블에 쓰는 유일한 경로다(평가위원 채점 저장에서는 더 이상 쓰지 않는다).
export async function saveChairOpinion(
  sessionId: string,
  subjectId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'auth' }
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { chairId: true, status: true },
  })
  if (!session || session.chairId !== user.id) return { ok: false, error: '위원장만 작성할 수 있습니다.' }
  if (session.status === 'CLOSED') return { ok: false, error: '마감된 분과입니다.' }

  const text = String(formData.get('opinion') ?? '').trim()
  if (text) {
    await prisma.opinion.upsert({
      where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
      update: { text, sessionId },
      create: { evaluatorId: user.id, subjectId, sessionId, text },
    })
  } else {
    await prisma.opinion.deleteMany({ where: { evaluatorId: user.id, subjectId } })
  }
  revalidatePath(`/evaluate/${sessionId}/chair/${subjectId}`)
  return { ok: true }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: 커밋**

```bash
git add app/evaluate/actions.ts
git commit -m "feat(evaluate): 위원장 대상별 종합의견 저장 액션"
```

---

### Task 4: 대상별 위원장 화면

이 Task가 끝나면 URL로 직접 접근해 기능을 쓸 수 있다(진입 버튼은 Task 5).

**Files:**
- Create: `app/evaluate/[sessionId]/chair/[subjectId]/page.tsx`
- Create: `app/evaluate/[sessionId]/chair/[subjectId]/ChairSubjectClient.tsx`

**Interfaces:**
- Consumes: `ChairSubjectData` (Task 2), `GET /api/evaluate/chair/subject` (Task 2), `saveChairOpinion` (Task 3)
- Produces: 라우트 `/evaluate/[sessionId]/chair/[subjectId]`

- [ ] **Step 1: 서버 페이지 작성**

`app/evaluate/[sessionId]/chair/[subjectId]/page.tsx`:

```tsx
import ChairSubjectClient from './ChairSubjectClient'

// 위원장 대상별 종합의견 — 풀 CSR.
// 데이터/권한은 /api/evaluate/chair/subject 에서 처리(위원장 아니면 403 → /evaluate 리다이렉트).
export default async function ChairSubjectPage({
  params,
}: {
  params: Promise<{ sessionId: string; subjectId: string }>
}) {
  const { sessionId, subjectId } = await params
  return <ChairSubjectClient sessionId={sessionId} subjectId={subjectId} />
}
```

- [ ] **Step 2: 클라이언트 컴포넌트 작성**

`app/evaluate/[sessionId]/chair/[subjectId]/ChairSubjectClient.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveChairOpinion } from '@/app/evaluate/actions'
import { SkeletonTable } from '@/components/Skeletons'
import type { ChairSubjectData } from '@/lib/evaluate-data'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export default function ChairSubjectClient({
  sessionId,
  subjectId,
}: {
  sessionId: string
  subjectId: string
}) {
  const router = useRouter()
  const [data, setData] = useState<ChairSubjectData | null>(null)
  const [opinion, setOpinion] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    let ignore = false
    setData(null)
    setStatus('idle')
    fetch(
      `/api/evaluate/chair/subject?sessionId=${encodeURIComponent(sessionId)}&subjectId=${encodeURIComponent(subjectId)}`,
      { cache: 'no-store' },
    )
      .then((r) => {
        if (r.status === 403) { router.replace('/evaluate'); return null } // 위원장 아님
        return r.ok ? r.json() : Promise.reject(r.status)
      })
      .then((d: ChairSubjectData | null) => {
        if (ignore || !d) return
        setData(d)
        setOpinion(d.chairOpinion)
      })
      .catch(() => { if (!ignore) router.replace('/evaluate') })
    return () => { ignore = true }
  }, [sessionId, subjectId, router])

  const onSave = () => {
    setStatus('idle')
    const fd = new FormData()
    fd.set('opinion', opinion)
    start(async () => {
      const res = await saveChairOpinion(sessionId, subjectId, fd)
      if (res?.ok) {
        setStatus('saved')
      } else {
        setStatus('error')
        setErrorMsg(res?.error ?? '저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
      {/* 헤더 — 목록 복귀 + 대상명 + 이전/다음 대상 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/evaluate"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            ← 대상 목록
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data?.subjectName ?? ' '}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {data?.sessionName ?? ''} · 위원장 종합의견
            </p>
          </div>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            {data.prevSubjectId ? (
              <Link
                href={`/evaluate/${sessionId}/chair/${data.prevSubjectId}`}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                ← 이전 대상
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-300">← 이전 대상</span>
            )}
            {data.nextSubjectId ? (
              <Link
                href={`/evaluate/${sessionId}/chair/${data.nextSubjectId}`}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                다음 대상 →
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-300">다음 대상 →</span>
            )}
          </div>
        )}
      </div>

      {!data ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* 좌: 위원별 점수·의견·제출 유무 */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="table-grid w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 font-medium">평가위원명</th>
                  <th className="px-4 py-2.5 font-medium">종합점수</th>
                  <th className="px-4 py-2.5 font-medium">항목당 의견</th>
                  <th className="px-4 py-2.5 font-medium">제출 유무</th>
                </tr>
              </thead>
              <tbody>
                {data.evaluators.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      배정된 평가위원이 없습니다.
                    </td>
                  </tr>
                )}
                {data.evaluators.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {e.name}
                      {e.isChair && <span className="ml-1 text-xs text-indigo-600">(위원장)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {e.total != null ? (
                        <span className="text-lg font-bold text-indigo-700 tabular-nums">{fmt(e.total)}</span>
                      ) : e.state === 'partial' ? (
                        <span className="text-xs text-amber-600">입력중</span>
                      ) : (
                        <span className="text-xs text-slate-400">입력전</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {e.groupComments.length === 0 ? (
                        <span className="text-xs text-slate-400">의견 없음</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {e.groupComments.map((gc, i) => (
                            <li key={i}>
                              <div className="text-xs font-semibold text-slate-500">{gc.groupName}</div>
                              <p className="whitespace-pre-wrap text-sm text-slate-700">{gc.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={e.submitted ? 'text-slate-900' : 'text-rose-600'}>
                        {e.submitted ? '제출' : '미제출'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 우: 종합의견 작성 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">종합의견 (위원장)</span>
              <span className="text-xs text-slate-400">{opinion.length}자</span>
            </div>
            <textarea
              value={opinion}
              onChange={(e) => { setOpinion(e.target.value); setStatus('idle') }}
              disabled={data.locked}
              rows={14}
              placeholder="이 대상에 대한 위원장 종합의견을 작성하세요."
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
            {data.locked ? (
              <p className="mt-3 text-xs text-slate-400">마감된 분과입니다. 수정할 수 없습니다.</p>
            ) : (
              <div className="mt-3 flex items-center justify-end gap-3">
                {status === 'saved' && <span className="text-xs text-emerald-600">저장되었습니다.</span>}
                {status === 'error' && <span className="text-xs text-rose-600">{errorMsg}</span>}
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {pending ? '저장 중…' : '종합의견 저장'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: 라이브 확인 (Playwright)**

`scripts/.verify-chair-page.tmp.ts`:

```ts
import { chromium } from '@playwright/test'
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

async function main() {
  const s = await prisma.evaluationSession.findFirst({
    where: { chairId: { not: null }, subjects: { some: {} } },
    select: { id: true, chairId: true, subjects: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 } },
  })
  const subjectId = s!.subjects[0].id
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  await ctx.addCookies([{ name: 'auth_token', value: await signToken({ userId: s!.chairId!, role: 'EVALUATOR' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:3000/evaluate/${s!.id}/chair/${subjectId}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('columnheader', { name: '평가위원명' }).waitFor({ timeout: 60000 })
  console.log('표 컬럼 4개:', await page.locator('thead th').count())
  // 종합의견 저장 왕복
  const box = page.locator('textarea')
  await box.fill('플레이라이트 검증용 종합의견')
  await page.getByRole('button', { name: '종합의견 저장' }).click()
  await page.getByText('저장되었습니다.').waitFor({ timeout: 10000 })
  const saved = await prisma.opinion.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId: s!.chairId!, subjectId } },
    select: { text: true },
  })
  console.log('DB 저장 확인:', saved?.text)
  // 원복 — 검증 전 상태로 되돌린다
  await prisma.opinion.deleteMany({ where: { evaluatorId: s!.chairId!, subjectId } })

  // 비위원장 접근 차단 확인 — 같은 분과의 위원장 아닌 위원으로 접근
  const other = await prisma.assignment.findFirst({
    where: { sessionId: s!.id, userId: { not: s!.chairId! } },
    select: { userId: true },
  })
  if (other) {
    const ctx2 = await browser.newContext()
    await ctx2.addCookies([{ name: 'auth_token', value: await signToken({ userId: other.userId, role: 'EVALUATOR' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
    const p2 = await ctx2.newPage()
    await p2.goto(`http://localhost:3000/evaluate/${s!.id}/chair/${subjectId}`, { waitUntil: 'domcontentloaded' })
    await p2.waitForURL('**/evaluate', { timeout: 15000 })
    console.log('비위원장 리다이렉트 확인:', new URL(p2.url()).pathname)
  } else {
    console.log('비위원장 위원이 없어 차단 검증 생략')
  }

  await browser.close()
  await prisma.$disconnect()
}
main()
```

Run: `npx tsx scripts/.verify-chair-page.tmp.ts && rm -f scripts/.verify-chair-page.tmp.ts`
Expected: `표 컬럼 4개: 4`, `DB 저장 확인: 플레이라이트 검증용 종합의견`, `비위원장 리다이렉트 확인: /evaluate`. 검증 데이터는 스크립트가 스스로 삭제한다.

- [ ] **Step 5: 커밋**

```bash
git add "app/evaluate/[sessionId]/chair/[subjectId]"
git commit -m "feat(evaluate): 위원장 대상별 종합의견 화면 추가"
```

---

### Task 5: 진입 경로 연결

**Files:**
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx` (위원장 전용 링크)
- Modify: `app/evaluate/EvaluateHomeClient.tsx` (분과 헤더 링크 제거, 대상별 링크 추가)

**Interfaces:**
- Consumes: 라우트 `/evaluate/[sessionId]/chair/[subjectId]` (Task 4)
- Produces: 없음

- [ ] **Step 1: 평가표 상단 링크를 현재 대상의 위원장 페이지로 변경**

`ScoreForm.tsx`에서 아래 블록을 찾아

```tsx
              <Link
                href={`/evaluate/${sessionId}/chair`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                다른 위원 평가 · 총평 →
              </Link>
```

다음으로 바꾼다:

```tsx
              <Link
                href={`/evaluate/${sessionId}/chair/${subjectId}`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                이 대상 종합의견 →
              </Link>
```

- [ ] **Step 2: 대상 목록의 분과 헤더에서 옛 총괄평가 링크 제거**

`EvaluateHomeClient.tsx`에서 아래 블록을 찾아 **통째로 삭제**한다(연결 대상 페이지가 Task 7에서 사라진다):

```tsx
                {s.isChair && (
                  <Link
                    href={`/evaluate/${s.sessionId}/chair`}
                    className="rounded-md border border-white/40 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                  >
                    총괄평가 →
                  </Link>
                )}
```

- [ ] **Step 3: 대상 카드에 위원장 전용 '종합의견' 링크 추가**

`EvaluateHomeClient.tsx`의 대상 카드에서 아래 링크를 찾아

```tsx
                      <Link
                        href={`/evaluate/${s.sessionId}/${sub.id}`}
                        className="shrink-0 whitespace-nowrap text-sm text-indigo-600"
                      >
                        {sub.status === "complete"
                          ? "수정"
                          : sub.status === "inProgress"
                            ? "이어하기 →"
                            : "평가 시작 →"}
                      </Link>
```

바로 **아래에** 다음을 추가한다:

```tsx
                      {s.isChair && (
                        <Link
                          href={`/evaluate/${s.sessionId}/chair/${sub.id}`}
                          className="shrink-0 whitespace-nowrap text-sm text-slate-500 hover:text-indigo-600"
                        >
                          종합의견
                        </Link>
                      )}
```

같은 블록의 컨테이너 `<div className="flex w-36 shrink-0 items-center justify-end gap-2.5">`는 폭이 좁아 링크가 겹치므로, `w-36`을 `w-52`로 넓힌다.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 라이브 확인**

`scripts/.verify-chair-entry.tmp.ts`:

```ts
import { chromium } from '@playwright/test'
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

async function main() {
  const s = await prisma.evaluationSession.findFirst({
    where: { chairId: { not: null }, subjects: { some: {} } },
    select: { id: true, chairId: true },
  })
  const browser = await chromium.launch()

  // 위원장 — 대상마다 '종합의견' 링크가 보이고 클릭 시 대상별 페이지로 이동
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  await ctx.addCookies([{ name: 'auth_token', value: await signToken({ userId: s!.chairId!, role: 'EVALUATOR' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto('http://localhost:3000/evaluate', { waitUntil: 'domcontentloaded' })
  const links = page.getByRole('link', { name: '종합의견' })
  await links.first().waitFor({ timeout: 30000 })
  console.log('위원장 종합의견 링크 수:', await links.count())
  console.log('옛 총괄평가 링크 남아있나(0이어야):', await page.getByRole('link', { name: '총괄평가 →' }).count())
  await links.first().click()
  await page.waitForURL('**/chair/**', { timeout: 15000 })
  console.log('이동한 URL:', new URL(page.url()).pathname)

  // 비위원장 — 링크가 없어야 한다
  const other = await prisma.assignment.findFirst({
    where: { sessionId: s!.id, userId: { not: s!.chairId! } },
    select: { userId: true },
  })
  if (other) {
    const ctx2 = await browser.newContext()
    await ctx2.addCookies([{ name: 'auth_token', value: await signToken({ userId: other.userId, role: 'EVALUATOR' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
    const p2 = await ctx2.newPage()
    await p2.goto('http://localhost:3000/evaluate', { waitUntil: 'domcontentloaded' })
    await p2.waitForTimeout(2000)
    console.log('비위원장 종합의견 링크 수(0이어야):', await p2.getByRole('link', { name: '종합의견' }).count())
  }

  await browser.close()
  await prisma.$disconnect()
}
main()
```

Run: `npx tsx scripts/.verify-chair-entry.tmp.ts && rm -f scripts/.verify-chair-entry.tmp.ts`
Expected: 위원장 링크 수 ≥ 1, 옛 총괄평가 링크 0, 이동 URL이 `/evaluate/<sessionId>/chair/<subjectId>`, 비위원장 링크 수 0

- [ ] **Step 6: 커밋**

```bash
git add "app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx" app/evaluate/EvaluateHomeClient.tsx
git commit -m "feat(evaluate): 위원장 대상별 종합의견 진입 경로 연결"
```

---

### Task 6: 평가위원 종합의견 제거

**Files:**
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx`
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreSheetClient.tsx`
- Modify: `lib/evaluate-data.ts` (`SheetData.initialComment`, `getSheetData`의 opinion 조회)
- Modify: `app/evaluate/actions.ts` (채점 저장의 `comment` 처리)

**Interfaces:**
- Consumes: 없음
- Produces: `SheetData`에서 `initialComment` 필드 제거, `ScoreForm`에서 `initialComment` prop 제거

- [ ] **Step 1: 평가표 하단 종합의견 행 삭제**

`ScoreForm.tsx`에서 아래 블록을 통째로 삭제한다:

```tsx
                {/* 종합의견 — 평가항목별 의견과 같은 결로 표 맨 아래 전체 폭(제출 시 comment로 저장) */}
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td colSpan={5} className="px-3 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">종합의견</span>
                      <span className="text-xs text-slate-400">{comment.length} / 1000</span>
                    </div>
                    <textarea
                      name="comment"
                      value={comment}
                      maxLength={1000}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={locked}
                      rows={4}
                      placeholder="대상에 대한 종합적인 평가 의견을 입력하세요. (선택)"
                      className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                  </td>
                </tr>
```

- [ ] **Step 2: `ScoreForm.tsx`에서 comment 상태와 prop 제거**

- `const [comment, setComment] = useState(initialComment);` 줄 삭제
- 구조분해 인자 목록에서 `initialComment,` 삭제
- props 타입에서 `initialComment: string;` 삭제

- [ ] **Step 3: `ScoreSheetClient.tsx`에서 prop 전달 제거**

`<ScoreForm ... />` 호출에서 `initialComment={data.initialComment}` 줄을 삭제한다.

- [ ] **Step 4: `lib/evaluate-data.ts`에서 initialComment 제거**

세 곳을 고친다.

1. `SheetData` 인터페이스에서 `initialComment: string` 줄 삭제
2. `getSheetData`의 `Promise.all` 구조분해에서 `opinion,`을 빼고, 배열에서 아래 줄을 삭제

```ts
    prisma.opinion.findUnique({ where: { evaluatorId_subjectId: { evaluatorId: userId, subjectId } } }),
```

3. 반환 객체에서 `initialComment: opinion?.text ?? '',` 줄 삭제

- [ ] **Step 5: 채점 저장 액션에서 comment 처리 제거**

`app/evaluate/actions.ts`에서 아래 블록을 통째로 삭제한다:

```ts
  // 종합의견 저장
  const comment = String(formData.get('comment') ?? '').trim()
  if (comment) {
    await prisma.opinion.upsert({
      where: { evaluatorId_subjectId: { evaluatorId: user.id, subjectId } },
      update: { text: comment, sessionId },
      create: { evaluatorId: user.id, subjectId, sessionId, text: comment },
    })
  } else {
    await prisma.opinion.deleteMany({ where: { evaluatorId: user.id, subjectId } })
  }
```

- [ ] **Step 6: `Opinion` 쓰기 경로가 하나만 남았는지 확인**

Run: `grep -rn "prisma.opinion.upsert\|prisma.opinion.deleteMany" app/ lib/ | grep -v node_modules`
Expected: `app/evaluate/actions.ts`의 `saveChairOpinion` 안 두 줄만 나온다.

- [ ] **Step 7: 빌드 + 전체 테스트**

Run: `npm run build && npm test`
Expected: `✓ Compiled successfully`, 전체 테스트 통과

- [ ] **Step 8: 라이브 확인**

`scripts/.verify-no-comment.tmp.ts`:

```ts
import { chromium } from '@playwright/test'
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

async function main() {
  const a = await prisma.assignment.findFirst({
    where: { session: { subjects: { some: {} }, status: { not: 'CLOSED' } } },
    select: { userId: true, sessionId: true, session: { select: { subjects: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 } } } },
  })
  const subjectId = a!.session.subjects[0].id
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addCookies([{ name: 'auth_token', value: await signToken({ userId: a!.userId, role: 'EVALUATOR' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:3000/evaluate/${a!.sessionId}/${subjectId}`, { waitUntil: 'domcontentloaded' })
  await page.getByText('현재 점수').waitFor({ timeout: 30000 })
  console.log('종합의견 입력칸 수(0이어야):', await page.locator('textarea[name=comment]').count())
  console.log("'종합의견' 라벨 수(0이어야):", await page.getByText('종합의견', { exact: true }).count())
  // 임시 저장이 여전히 동작하는지
  const save = page.getByRole('button', { name: '임시 저장' })
  if (await save.count()) {
    await save.click()
    await page.getByText('임시 저장되었습니다.').waitFor({ timeout: 15000 })
    console.log('임시 저장 정상')
  } else {
    console.log('잠금 상태라 임시 저장 검증 생략')
  }
  await browser.close()
  await prisma.$disconnect()
}
main()
```

Run: `npx tsx scripts/.verify-no-comment.tmp.ts && rm -f scripts/.verify-no-comment.tmp.ts`
Expected: 입력칸 0, 라벨 0, `임시 저장 정상`

- [ ] **Step 9: 커밋**

```bash
git add "app/evaluate/[sessionId]/[subjectId]" lib/evaluate-data.ts app/evaluate/actions.ts
git commit -m "refactor(evaluate): 평가위원 종합의견 제거 — 위원장 전용으로 일원화"
```

---

### Task 7: 옛 위원장 총괄표·분과 총괄평가 제거

**Files:**
- Delete: `app/evaluate/[sessionId]/chair/page.tsx`
- Delete: `app/evaluate/[sessionId]/chair/ChairClient.tsx`
- Delete: `app/api/evaluate/chair/route.ts`
- Delete: `components/ChairSummaryForm.tsx`
- Delete: `components/ChairScoreCell.tsx`
- Modify: `lib/evaluate-data.ts` (`getChairData`, `ChairData`, `ChairRow`, `ChairCell` 삭제)
- Modify: `app/evaluate/actions.ts` (`saveChairSummary` 삭제)
- Modify: `app/admin/sessions/[id]/results/page.tsx` (총괄평가 표시 블록 삭제)

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 파일 삭제**

```bash
rm -f "app/evaluate/[sessionId]/chair/page.tsx" \
      "app/evaluate/[sessionId]/chair/ChairClient.tsx" \
      app/api/evaluate/chair/route.ts \
      components/ChairSummaryForm.tsx \
      components/ChairScoreCell.tsx
```

- [ ] **Step 2: `lib/evaluate-data.ts`에서 옛 총괄표 코드 삭제**

`// ── 위원장 총괄표 ──` 주석부터 `getChairData` 함수의 닫는 중괄호까지 통째로 삭제한다. 삭제 범위에 포함되는 것: `ChairCell`, `ChairRow`, `ChairData` 인터페이스와 `getChairData` 함수. (바로 아래 `// ── 위원장 대상별 상세 ──` 블록은 Task 2에서 추가한 것이므로 남긴다.)

- [ ] **Step 3: `app/evaluate/actions.ts`에서 `saveChairSummary` 삭제**

`saveChairSummary` 함수 전체(주석 포함)를 삭제한다. `saveChairOpinion`은 남긴다.

- [ ] **Step 4: 간사 집계 결과의 총괄평가 블록 삭제**

`app/admin/sessions/[id]/results/page.tsx`에서 아래 블록을 통째로 삭제한다:

```tsx
      {/* 위원장 총괄평가 */}
      {session?.chairSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 print:border-black">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">위원장 총괄평가</span>
            {chair && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 print:bg-transparent print:text-black">{chair.name} 위원장</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{session.chairSummary}</p>
        </div>
      )}
```

삭제 후 같은 파일에서 `chair` 변수가 다른 곳에 쓰이지 않으면 그 선언도 함께 지운다.

Run: `grep -n "chair" "app/admin/sessions/[id]/results/page.tsx"`
Expected: 남은 참조가 없으면 선언 삭제, 있으면 그대로 둔다.

- [ ] **Step 5: 잔여 참조가 없는지 확인**

Run: `grep -rn "ChairSummaryForm\|ChairScoreCell\|getChairData\|saveChairSummary\|chairSummary" app/ components/ lib/ | grep -v node_modules`
Expected: 출력 없음 (`chairSummary`는 `prisma/schema.prisma`에만 남아 있어야 하며, 위 경로에는 나오지 않는다)

- [ ] **Step 6: 빌드 + 전체 테스트**

Run: `npm run build && npm test`
Expected: `✓ Compiled successfully`, 전체 테스트 통과

- [ ] **Step 7: 회귀 확인 — 관리자 평가의견서**

새 화면에서 저장한 의견이 관리자 평가의견서에 그대로 보이면, 손대지 않은 관리자 화면까지 데이터 흐름이 연결된 것이다.

`scripts/.verify-admin-opinion.tmp.ts`:

```ts
import { chromium } from '@playwright/test'
import { prisma } from '../lib/db'
import { signToken } from '../lib/auth'

const TEXT = '회귀검증용 위원장 종합의견'

async function main() {
  const s = await prisma.evaluationSession.findFirst({
    where: { chairId: { not: null }, subjects: { some: {} }, projectId: { not: null } },
    select: { id: true, name: true, chairId: true, projectId: true, subjects: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 } },
  })
  const subjectId = s!.subjects[0].id
  // 위원장 의견을 직접 심어 둔다(저장 경로는 Task 4에서 이미 검증)
  await prisma.opinion.upsert({
    where: { evaluatorId_subjectId: { evaluatorId: s!.chairId!, subjectId } },
    update: { text: TEXT, sessionId: s!.id },
    create: { evaluatorId: s!.chairId!, subjectId, sessionId: s!.id, text: TEXT },
  })
  const master = await prisma.user.findFirst({ where: { role: 'MASTER' }, select: { id: true } })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  await ctx.addCookies([{ name: 'auth_token', value: await signToken({ userId: master!.id, role: 'MASTER' }), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:3000/admin/projects/${s!.projectId}/opinions`, { waitUntil: 'domcontentloaded' })
  await page.locator('table').first().waitFor({ timeout: 30000 })
  await page.locator('tr', { hasText: s!.name }).last().getByRole('button', { name: '자세히 보기' }).click()
  await page.getByText(TEXT).waitFor({ timeout: 15000 })
  console.log('관리자 평가의견서 모달에 표시 확인')
  await browser.close()
  // 원복
  await prisma.opinion.deleteMany({ where: { evaluatorId: s!.chairId!, subjectId } })
  await prisma.$disconnect()
}
main()
```

Run: `npx tsx scripts/.verify-admin-opinion.tmp.ts && rm -f scripts/.verify-admin-opinion.tmp.ts`
Expected: `관리자 평가의견서 모달에 표시 확인`. 심어둔 검증 데이터는 스크립트가 스스로 삭제한다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor(evaluate): 위원장 총괄표·분과 총괄평가 제거"
```

---

## 완료 기준

- 평가위원 평가표에 종합의견 입력칸이 없다.
- 위원장은 `/evaluate` 대상 목록과 평가표 상단 링크로 대상별 페이지에 들어가, 위원별 `평가위원명·종합점수·항목당 의견·제출 유무`를 보며 종합의견을 저장할 수 있다.
- 비위원장이 대상별 페이지 URL로 직접 접근하면 `/evaluate`로 튕긴다.
- 옛 위원장 총괄표와 분과 총괄평가는 화면에서 사라졌고, `Opinion`에 쓰는 경로는 `saveChairOpinion` 하나뿐이다.
- 관리자 평가의견서는 손대지 않았는데도 새로 저장한 위원장 종합의견을 그대로 보여준다.
- `npm test` 전체 통과, `npm run build` 통과.
