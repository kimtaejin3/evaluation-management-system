# 평가지 3단계 구조 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평가 항목을 2단계(section→Criterion)에서 3단계(평가항목→세부항목→평가지표)로 대체하고, 평가위원 입력 시 배점 초과를 차단한다.

**Architecture:** 접근법 A — 채점 리프인 `Criterion`(=평가지표)은 유지하고 위에 `CriterionGroup`(평가항목)·`CriterionSubitem`(세부항목) 두 부모를 추가한다. `Score.criterionId`와 `lib/scoring.ts`(가중치·합산·랭킹)는 불변. 정성(등급) 채점은 제거하고 숫자 배점 전용. 스키마 변경은 **가산(부모 테이블/컬럼 추가) → 소비자 코드 이전 → 파괴(구컬럼 제거)** 순서로 진행해 매 태스크마다 빌드가 통과하도록 한다.

**Tech Stack:** Next.js 16(App Router, webpack), Prisma + Postgres(Neon), TypeScript, vitest, tsx.

## Global Constraints

- 테스트/빌드는 **Node 22**에서: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` 후 `npm test` / `npm run build` / `npm run test:core`. (dev 서버는 Node 21이라 vitest가 깨짐)
- 마이그레이션은 **hand-authored SQL** + `npx prisma migrate deploy`(shadow DB 회피). 데이터 백필은 별도 **tsx 스크립트**(1회 실행).
- DB는 공유 Neon(개발). 파괴적 스키마 변경은 **모든 소비자 코드 이전 후** 마지막에.
- 숫자 배점 전용: 정성(QUALITATIVE)·`gradeOptions`·등급 select 경로 제거. 0점 입력은 허용.
- `Score` 모델·`@@unique([evaluatorId, subjectId, criterionId])`·`lib/scoring.ts`는 **변경 금지**(리프 id 그대로 사용).
- 배점 상한: 서버는 `isValidScoreValue(value, maxScore)`로 거부, 클라이언트는 `0~maxScore` 클램프+제출 차단.
- 커밋은 태스크 단위로 자주. main 직접 커밋(현 워크플로).

---

## File Structure

**신규**
- `prisma/migrations/20260702110000_criteria_3level_add/migration.sql` — 부모 테이블 생성 + `Criterion.subitemId` nullable 추가 + `type` 기본값.
- `scripts/backfill-3level.ts` — 기존 데이터 3단계 이관(1회).
- `prisma/migrations/20260702120000_criteria_3level_cleanup/migration.sql` — subitemId NOT NULL + 구컬럼/enum/템플릿 제거.
- `lib/criteria.ts` (+ `lib/criteria.test.ts`) — 평가항목 배점 합계/균형 판정 순수 헬퍼.
- `components/CriteriaEditor.tsx` — 관리자 3단계 인라인 트리 편집기(client).

**수정**
- `prisma/schema.prisma` — 모델 3종.
- `app/admin/sessions/actions.ts` — 신규 그룹/세부항목/지표 액션, 구 `addCriterion/updateCriterion/renameSection` 제거, `commitKpassImport` 어댑터.
- `app/admin/sessions/[id]/criteria/page.tsx` — 3단계 조회 + `CriteriaEditor` 렌더.
- `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx` — 3단계 렌더 + 배점 상한(클라).
- `app/evaluate/actions.ts` — 배점 상한(서버) + 정성 경로 제거.
- `lib/evaluate-data.ts` — 리프 뷰에 group/subitem 부여, 정성 제거.
- `app/admin/sessions/[id]/results/page.tsx`, `app/admin/sessions/[id]/breakdown/page.tsx`, `lib/progress.ts`, `app/api/sessions/[id]/results.csv/route.ts` — 표시 그룹핑을 group/subitem으로.
- `components/CriterionForm.tsx`, `components/AddCriterionButton.tsx`, `components/EditCriterionButton.tsx` — 구조 대체로 제거/교체.
- `scripts/demo-seed.ts`, `scripts/core-e2e.ts`, `scripts/e2e-check.ts` — 3단계 생성으로.

---

### Task 1: 스키마 가산 마이그레이션 (부모 테이블 + subitemId nullable)

**Files:**
- Modify: `prisma/schema.prisma` (Criterion 블록 83-98, EvaluationSession 관계 70)
- Create: `prisma/migrations/20260702110000_criteria_3level_add/migration.sql`

**Interfaces:**
- Produces: `CriterionGroup{ id, sessionId, name, maxScore, order, subitems }`, `CriterionSubitem{ id, groupId, name, order, criteria }`, `Criterion.subitemId String?` + `subitem` 관계, `EvaluationSession.criterionGroups`.

- [ ] **Step 1: schema.prisma에 모델 추가/수정**

`EvaluationSession` 모델의 `criteria    Criterion[]` 아래 줄에 추가:
```prisma
  criterionGroups CriterionGroup[]
```

`Criterion` 모델(83-98)을 다음으로 교체 — 구컬럼은 **유지**하고 `subitemId?`·`subitem` 관계 추가, `type` 기본값 부여:
```prisma
model Criterion {
  id          String            @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  section     String?
  name        String
  description String?
  type        CriterionType     @default(QUANTITATIVE)
  maxScore    Float
  weight      Float             @default(1)
  order       Int               @default(0)
  gradeOptions Json?
  subitemId   String?
  subitem     CriterionSubitem? @relation(fields: [subitemId], references: [id], onDelete: Cascade)
  scores      Score[]
}
```

`Criterion` 모델 뒤에 추가:
```prisma
model CriterionGroup {
  id        String            @id @default(cuid())
  sessionId String
  session   EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name      String
  maxScore  Float             @default(0)
  order     Int               @default(0)
  subitems  CriterionSubitem[]

  @@index([sessionId])
}

model CriterionSubitem {
  id       String         @id @default(cuid())
  groupId  String
  group    CriterionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name     String
  order    Int            @default(0)
  criteria Criterion[]

  @@index([groupId])
}
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`prisma/migrations/20260702110000_criteria_3level_add/migration.sql`:
```sql
CREATE TABLE "CriterionGroup" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CriterionGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CriterionGroup_sessionId_idx" ON "CriterionGroup"("sessionId");
ALTER TABLE "CriterionGroup" ADD CONSTRAINT "CriterionGroup_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CriterionSubitem" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CriterionSubitem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CriterionSubitem_groupId_idx" ON "CriterionSubitem"("groupId");
ALTER TABLE "CriterionSubitem" ADD CONSTRAINT "CriterionSubitem_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "CriterionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Criterion" ADD COLUMN "subitemId" TEXT;
ALTER TABLE "Criterion" ALTER COLUMN "type" SET DEFAULT 'QUANTITATIVE';
CREATE INDEX "Criterion_subitemId_idx" ON "Criterion"("subitemId");
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_subitemId_fkey"
  FOREIGN KEY ("subitemId") REFERENCES "CriterionSubitem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: 적용 + 생성**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx prisma migrate deploy && npx prisma generate
```
Expected: 마이그레이션 1건 적용, generate 성공.

- [ ] **Step 4: 빌드 확인(구코드 그대로 컴파일)**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build`
Expected: `✓ Compiled successfully`. (구컬럼 유지라 기존 코드 무변경으로 통과)

- [ ] **Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/20260702110000_criteria_3level_add
git commit -m "feat(criteria): 3단계 부모 테이블(평가항목/세부항목) 추가 마이그레이션"
```

---

### Task 2: 기존 데이터 백필 스크립트 (자동 이관)

**Files:**
- Create: `scripts/backfill-3level.ts`

**Interfaces:**
- Consumes: Task 1의 `criterionGroup`/`criterionSubitem`/`criterion.subitemId`.
- Produces: 모든 기존 `Criterion.subitemId`가 채워지고, 세션별 그룹/세부항목이 생성된 DB 상태.

- [ ] **Step 1: 백필 스크립트 작성**

`scripts/backfill-3level.ts`:
```ts
import { prisma } from '../lib/db'

async function main() {
  const sessions = await prisma.evaluationSession.findMany({ select: { id: true } })
  let migrated = 0
  for (const { id: sessionId } of sessions) {
    const criteria = await prisma.criterion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } })
    if (criteria.length === 0) continue
    if (criteria.every((c) => c.subitemId)) continue // 이미 이관됨(멱등)

    // section 최초 등장 순서로 평가항목(그룹) 생성
    const sectionOrder: string[] = []
    for (const c of criteria) {
      const key = c.section ?? '기타'
      if (!sectionOrder.includes(key)) sectionOrder.push(key)
    }
    const groupIdByKey = new Map<string, string>()
    for (let i = 0; i < sectionOrder.length; i++) {
      const key = sectionOrder[i]
      const g = await prisma.criterionGroup.create({ data: { sessionId, name: key, order: i, maxScore: 0 } })
      groupIdByKey.set(key, g.id)
    }

    // 기존 Criterion 각각 → 세부항목 1개 + 리프 연결(name = description ?? name)
    const subCountByGroup = new Map<string, number>()
    for (const c of criteria) {
      if (c.subitemId) continue
      const key = c.section ?? '기타'
      const groupId = groupIdByKey.get(key)!
      const so = subCountByGroup.get(groupId) ?? 0
      const sub = await prisma.criterionSubitem.create({ data: { groupId, name: c.name, order: so } })
      subCountByGroup.set(groupId, so + 1)
      await prisma.criterion.update({ where: { id: c.id }, data: { subitemId: sub.id, name: c.description ?? c.name } })
    }

    // 평가항목 목표배점 = 하위 배점 합
    for (const [key, groupId] of groupIdByKey) {
      const sum = criteria.filter((c) => (c.section ?? '기타') === key).reduce((a, c) => a + c.maxScore, 0)
      await prisma.criterionGroup.update({ where: { id: groupId }, data: { maxScore: sum } })
    }
    migrated++
  }
  console.log(`backfill done: ${migrated} sessions migrated`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: 실행**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npx tsx scripts/backfill-3level.ts`
Expected: `backfill done: N sessions migrated`.

- [ ] **Step 3: 검증 쿼리 (미이관 0 확인)**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsx -e "import{prisma}from'./lib/db';(async()=>{const n=await prisma.criterion.count({where:{subitemId:null}});const g=await prisma.criterionGroup.count();console.log('subitemId null:',n,'groups:',g);process.exit(0)})()"
```
Expected: `subitemId null: 0` (그룹 수 > 0).

- [ ] **Step 4: Commit**
```bash
git add scripts/backfill-3level.ts
git commit -m "feat(criteria): 기존 데이터 3단계 백필 스크립트(1회 실행 완료)"
```

---

### Task 3: 배점 합계 헬퍼 (lib/criteria.ts) — TDD

**Files:**
- Create: `lib/criteria.ts`, `lib/criteria.test.ts`

**Interfaces:**
- Produces: `groupTotal(criteria: {maxScore:number}[]): number`, `isGroupBalanced(target:number, leafSum:number): boolean`.

- [ ] **Step 1: 실패 테스트 작성**

`lib/criteria.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupTotal, isGroupBalanced } from './criteria'

describe('groupTotal', () => {
  it('배점 합을 반환', () => {
    expect(groupTotal([{ maxScore: 10 }, { maxScore: 20 }, { maxScore: 5 }])).toBe(35)
  })
  it('빈 배열은 0, 비유한값은 0으로 무시', () => {
    expect(groupTotal([])).toBe(0)
    expect(groupTotal([{ maxScore: NaN }, { maxScore: 10 }])).toBe(10)
  })
})

describe('isGroupBalanced', () => {
  it('목표와 합이 같으면 true(부동소수 허용)', () => {
    expect(isGroupBalanced(50, 50)).toBe(true)
    expect(isGroupBalanced(0.3, 0.1 + 0.2)).toBe(true)
  })
  it('다르면 false', () => {
    expect(isGroupBalanced(50, 45)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npx vitest run lib/criteria.test.ts`
Expected: FAIL (`criteria` 모듈 없음).

- [ ] **Step 3: 구현**

`lib/criteria.ts`:
```ts
// 평가항목(그룹) 배점 합계·균형 판정 — 관리 화면 경고 및 표시용 순수 유틸
export function groupTotal(criteria: { maxScore: number }[]): number {
  return criteria.reduce((a, c) => a + (Number.isFinite(c.maxScore) ? c.maxScore : 0), 0)
}

// 평가항목 목표배점 vs 하위 평가지표 배점 합 일치 여부(부동소수 오차 허용)
export function isGroupBalanced(target: number, leafSum: number): boolean {
  return Math.abs(target - leafSum) < 1e-9
}
```

- [ ] **Step 4: 통과 확인**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npx vitest run lib/criteria.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add lib/criteria.ts lib/criteria.test.ts
git commit -m "feat(criteria): 배점 합계·균형 헬퍼 + 테스트"
```

---

### Task 4: 관리자 3단계 authoring (서버 액션 + 트리 편집기)

**Files:**
- Modify: `app/admin/sessions/actions.ts` (구 `addCriterion`/`updateCriterion`/`renameSection` 제거, 신규 9개 액션 추가; `deleteCriterion`은 리프 삭제로 유지)
- Create: `components/CriteriaEditor.tsx`
- Modify: `app/admin/sessions/[id]/criteria/page.tsx` (3단계 조회 + 렌더)
- Delete: `components/CriterionForm.tsx`, `components/AddCriterionButton.tsx`, `components/EditCriterionButton.tsx` (구조 대체) — 단, 이 파일들을 import하던 곳은 모두 `CriteriaEditor`로 교체

**Interfaces:**
- Consumes: `lib/criteria.ts`의 `groupTotal`, `isGroupBalanced`; Task 1 모델.
- Produces(서버 액션, 모두 `assertSessionAccess`로 권한 검증; sessionId는 상위 관계로 유도):
  - `addGroup(sessionId: string, formData: FormData)` — name, maxScore
  - `updateGroup(groupId: string, formData: FormData)` — name, maxScore
  - `deleteGroup(groupId: string)`
  - `addSubitem(groupId: string, formData: FormData)` — name
  - `updateSubitem(subitemId: string, formData: FormData)` — name
  - `deleteSubitem(subitemId: string)`
  - `addCriterion(subitemId: string, formData: FormData)` — name(평가지표 텍스트), maxScore
  - `updateCriterion(criterionId: string, formData: FormData)` — name, maxScore
  - `deleteCriterion(criterionId: string)`

- [ ] **Step 1: 신규 서버 액션 작성**

`app/admin/sessions/actions.ts`에서 구 `addCriterion`/`updateCriterion`/`renameSection`을 제거하고 아래로 대체(각 함수는 `'use server'` 파일 내, `assertSessionAccess`·`revalidatePath('/admin/sessions/'+sessionId+'/criteria')` 사용). sessionId 유도용 조회 포함:

```ts
// 평가항목(그룹)
export async function addGroup(sessionId: string, formData: FormData) {
  await assertSessionAccess(sessionId)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const count = await prisma.criterionGroup.count({ where: { sessionId } })
  await prisma.criterionGroup.create({ data: { sessionId, name, maxScore, order: count } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}
export async function updateGroup(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  await assertSessionAccess(g.sessionId)
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterionGroup.update({ where: { id: groupId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
export async function deleteGroup(groupId: string) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  await assertSessionAccess(g.sessionId)
  await prisma.criterionGroup.delete({ where: { id: groupId } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
// 세부항목
export async function addSubitem(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  await assertSessionAccess(g.sessionId)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const count = await prisma.criterionSubitem.count({ where: { groupId } })
  await prisma.criterionSubitem.create({ data: { groupId, name, order: count } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
export async function updateSubitem(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  await assertSessionAccess(s.group.sessionId)
  const name = String(formData.get('name') ?? '').trim()
  if (name) await prisma.criterionSubitem.update({ where: { id: subitemId }, data: { name } })
  revalidatePath(`/admin/sessions/${s.group.sessionId}/criteria`)
}
export async function deleteSubitem(subitemId: string) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  await assertSessionAccess(s.group.sessionId)
  await prisma.criterionSubitem.delete({ where: { id: subitemId } })
  revalidatePath(`/admin/sessions/${s.group.sessionId}/criteria`)
}
// 평가지표(리프)
export async function addCriterion(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  const sessionId = s.group.sessionId
  await assertSessionAccess(sessionId)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const count = await prisma.criterion.count({ where: { sessionId } })
  await prisma.criterion.create({ data: { sessionId, subitemId, name, maxScore, order: count } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}
export async function updateCriterion(criterionId: string, formData: FormData) {
  const c = await prisma.criterion.findUnique({ where: { id: criterionId }, select: { sessionId: true } })
  if (!c) return
  await assertSessionAccess(c.sessionId)
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterion.update({ where: { id: criterionId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidatePath(`/admin/sessions/${c.sessionId}/criteria`)
}
export async function deleteCriterion(criterionId: string) {
  const c = await prisma.criterion.findUnique({ where: { id: criterionId }, select: { sessionId: true } })
  if (!c) return
  await assertSessionAccess(c.sessionId)
  await prisma.criterion.delete({ where: { id: criterionId } })
  revalidatePath(`/admin/sessions/${c.sessionId}/criteria`)
}
```

> 참고: 신규 `Criterion.create`는 `type`을 생략(DB 기본값 QUANTITATIVE) — Task 9에서 컬럼 제거됨.

- [ ] **Step 2: CriteriaEditor 컴포넌트 작성**

`components/CriteriaEditor.tsx` (client). Props:
```ts
type LeafDTO = { id: string; name: string; maxScore: number }
type SubitemDTO = { id: string; name: string; criteria: LeafDTO[] }
type GroupDTO = { id: string; name: string; maxScore: number; subitems: SubitemDTO[] }
export default function CriteriaEditor({ sessionId, groups }: { sessionId: string; groups: GroupDTO[] }) { /* ... */ }
```
요구 동작(사진 차용):
- 표 컬럼: `평가항목 | [세부항목 추가] | 세부항목 | [평가지표 추가] | 평가지표 | 배점 | 삭제`.
- 상단 `[평가항목 추가]` 버튼 → 이름·목표배점 입력 폼(모달 또는 인라인 행) → `addGroup(sessionId, fd)`.
- 각 평가항목 헤더에 `lib/criteria`의 `groupTotal(모든 하위 리프)`와 목표배점 표시, `isGroupBalanced`가 false면 경고 배지(예: `합계 45 / 목표 50 ⚠`).
- 평가항목별 `[세부항목 추가]` → `addSubitem(groupId, fd)`.
- 세부항목별 `[평가지표 추가]` → `addCriterion(subitemId, fd)` (name, maxScore).
- 이름/배점 인라인 수정: `updateGroup/updateSubitem/updateCriterion`.
- 각 행 `[삭제]`: `deleteGroup/deleteSubitem/deleteCriterion`.
- 서버 액션 호출은 `useTransition` + `router.refresh()` 패턴(기존 `AssignSecretaryModal.tsx` 참고). 액션은 `@/app/admin/sessions/actions`에서 import.
- 스타일은 기존 관리 화면 톤(테일윈드) 준수.

- [ ] **Step 3: criteria 페이지에서 3단계 조회 + 렌더**

`app/admin/sessions/[id]/criteria/page.tsx`를 아래 형태로 교체(핵심):
```tsx
const groups = await prisma.criterionGroup.findMany({
  where: { sessionId: id },
  orderBy: { order: 'asc' },
  include: {
    subitems: {
      orderBy: { order: 'asc' },
      include: { criteria: { orderBy: { order: 'asc' }, select: { id: true, name: true, maxScore: true } } },
    },
  },
})
// 총 배점 = 모든 리프 maxScore 합 (기존 합계 표시 유지)
// <CriteriaEditor sessionId={id} groups={groups} />
```
구 `AddCriterionButton`/`EditCriterionButton`/`CriterionForm` import·사용 제거. 엑셀·한글 가져오기 버튼(있으면)은 유지(임포트는 Task 7에서 어댑터로 계속 동작).

- [ ] **Step 4: 구 컴포넌트 삭제 + 참조 정리**

`components/CriterionForm.tsx`, `components/AddCriterionButton.tsx`, `components/EditCriterionButton.tsx` 삭제. 이들을 import하던 파일이 더 있으면(grep) 모두 제거/교체.
Run: `grep -rn "CriterionForm\|AddCriterionButton\|EditCriterionButton\|renameSection" app components`
Expected: 매치 없음.

- [ ] **Step 5: 빌드 + 스모크**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build
```
Expected: `✓ Compiled successfully`. dev 서버(localhost:3000)에서 관리자 로그인 → 한 분과의 `평가 항목` 탭에서 평가항목/세부항목/평가지표 추가·삭제·배점 수정·합계 경고 확인.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat(criteria): 관리자 3단계 authoring(트리 편집기 + 그룹/세부항목/지표 액션)"
```

---

### Task 5: 평가위원 입력 — 3단계 렌더 + 배점 상한

**Files:**
- Modify: `lib/evaluate-data.ts` (`getSheetData`/`getChairData`/`getHomeData`의 criteria 조회에 subitem→group include, 정성 파싱 제거, 뷰에 `groupName`/`subitemName` 부여)
- Modify: `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx` (section 그룹핑 → group/subitem 중첩, 정성 select 제거, 숫자 입력 클램프 + 초과 시 제출 차단)
- Modify: `app/evaluate/actions.ts` (`autoSaveScore`/`saveScores`에서 정성 경로 제거, 숫자·상한만; `parseGradeOptions/defaultGradeOptions` import 제거)

**Interfaces:**
- Consumes: Task 1 모델(리프의 `subitem.group`).
- Produces: `CriterionView`에 `groupName: string`, `subitemName: string` (기존 `section` 대체). 채점 키·계산은 리프 `id` 그대로.

- [ ] **Step 1: evaluate-data.ts 조회·뷰 수정**

criteria 조회를 리프 기준으로 하되 `subitem: { include: { group: true } }`를 include하고, `CriterionView` 생성 시 `groupName = c.subitem.group.name`, `subitemName = c.subitem.name`, `order`는 `group.order`→`subitem.order`→`criterion.order` 순으로 정렬. 정성(`type==='QUALITATIVE'`, `gradeOptions`) 분기·`options`/`selectedIndex` 제거(전부 숫자). 비교용 "다른 대상" 점수 매핑은 리프 id 그대로 유지.

- [ ] **Step 2: ScoreForm.tsx 렌더/입력 수정**

- 그룹핑을 `section` 단일 → `groupName`(평가항목) → `subitemName`(세부항목) → 지표 행 2단 중첩 헤더로.
- 정성 `<select>` 경로 삭제. 모든 항목 `<input type="number" min={0} max={maxScore} step="any">`.
- 입력 핸들러에서 값 클램프: 숫자 파싱 후 `Math.max(0, Math.min(maxScore, v))`로 보정하거나, 초과/음수면 해당 셀 경고 표시 + `canSubmit=false`.
- 제출 버튼 `disabled` 조건에 "모든 입력이 0~배점 범위"를 추가.
- 합계/기여도 계산(`contrib`, total)은 유지(정성 분기만 제거).

- [ ] **Step 3: evaluate/actions.ts 서버 검증 정리**

`autoSaveScore`/`saveScores`에서 정성 분기 제거: 항상 숫자로 파싱해 `isValidScoreValue(value, c.maxScore)`로 검증(false면 저장 거부/에러), `grade`는 항상 `null`. `import { isValidScoreValue } from '@/lib/scoring'`만 남기고 `parseGradeOptions/defaultGradeOptions` 제거.

- [ ] **Step 4: 빌드 + 스모크**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build`
Expected: `✓ Compiled successfully`. dev에서 평가위원 로그인 → 평가표가 평가항목→세부항목→지표로 표시되고, 배점 초과 입력이 차단(제출 불가/경고)되는지 확인.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(evaluate): 3단계 평가표 렌더 + 배점 초과 입력 방지(클라/서버)"
```

---

### Task 6: 집계·결과 표시 그룹핑 교체

**Files:**
- Modify: `app/admin/sessions/[id]/results/page.tsx`, `app/admin/sessions/[id]/breakdown/page.tsx`, `lib/progress.ts`, `app/api/sessions/[id]/results.csv/route.ts`

**Interfaces:**
- Consumes: Task 1 모델. 점수 계산은 `lib/scoring.ts` 그대로.

- [ ] **Step 1: 표시 그룹핑을 group/subitem으로**

각 파일에서 `criterion.section` 기반 그룹핑을 리프의 `subitem.group.name`/`subitem.name` 기반으로 교체. criteria 조회에 `include: { subitem: { include: { group: true } } }` 추가. 정렬은 `group.order → subitem.order → criterion.order`. `computeFinalScores/computeWeightedScore/rankSubjects` 호출부는 인자(리프 id·weight·value) 동일 유지.

- [ ] **Step 2: 빌드 + 스모크**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build`
Expected: `✓ Compiled successfully`. results/breakdown 페이지에서 평가항목/세부항목 헤더로 표가 렌더되고 합계·랭킹이 이전과 동일한지 확인.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat(results): 집계·결과 표시를 평가항목/세부항목 그룹핑으로 교체"
```

---

### Task 7: K-PASS 임포트 어댑터(3단계·숫자 전용)

**Files:**
- Modify: `app/admin/sessions/actions.ts` (`commitKpassImport`)

**Interfaces:**
- Consumes: `lib/kpass-import.ts`의 `buildCriteria`(시그니처 불변, 평탄한 `CriterionDraft[]` 반환). Task 4의 모델.

- [ ] **Step 1: commitKpassImport을 3단계 생성으로**

`buildCriteria` 결과(각 draft: `section, name, description, maxScore, ...`)를 다음으로 반영: `section`(없으면 '기타')별 `CriterionGroup` 생성/재사용 → draft마다 `CriterionSubitem`(name = draft.name) + `Criterion`(리프, name = draft.description ?? draft.name, maxScore = draft.maxScore) 생성. `type/gradeOptions`(등급열)는 무시(숫자 전용). 트랜잭션 밖에서 준비 후 트랜잭션에서 생성(기존 패턴). `replaceCriteria` 시 기존 `CriterionGroup`(및 cascade로 하위·점수) 삭제. 점수 존재 시 replace 차단 가드 유지. `group.maxScore` = 하위 리프 합.

- [ ] **Step 2: 빌드 + 스모크**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build`
Expected: `✓ Compiled successfully`. dev에서 엑셀·한글 가져오기로 표 붙여넣기 → 평가항목/세부항목/지표가 생성되는지 확인.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat(import): K-PASS 임포트를 3단계·숫자 전용 어댑터로"
```

---

### Task 8: 시드·통합테스트 3단계화

**Files:**
- Modify: `scripts/demo-seed.ts`, `scripts/core-e2e.ts`, `scripts/e2e-check.ts`

**Interfaces:**
- Consumes: Task 1 모델. `lib/scoring.ts` 불변.

- [ ] **Step 1: demo-seed.ts를 3단계 생성으로**

기존 `prisma.criterion.create({ section, name, type, maxScore, gradeOptions })`를 그룹→세부항목→리프 생성으로 교체. 정성 항목(GRADE_OPTS) 제거, 전부 숫자 `maxScore`. 점수 생성부(plan/score)는 리프 id 기준으로 그대로. 예: 사업계획(그룹) → '사업 타당성'(세부항목) → 리프(maxScore 40) 등.

- [ ] **Step 2: core-e2e.ts / e2e-check.ts를 3단계로**

criteria 생성·검증을 그룹/세부항목/리프로. 점수 상한 거부(값 > maxScore 저장 시 거부)를 재현하는 체크 추가(`isValidScoreValue` 조건 재현 또는 `saveScores` 경로).

- [ ] **Step 3: 실행**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run test:core && npm test
```
Expected: core-e2e 통과, 단위 테스트 전부 통과.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "test(criteria): 시드·통합테스트 3단계화 + 배점 상한 확인"
```

---

### Task 9: 파괴적 정리 마이그레이션(구컬럼/enum/템플릿 제거)

**Files:**
- Modify: `prisma/schema.prisma` (Criterion에서 `section/description/type/gradeOptions` 제거·`subitemId` 필수화, `enum CriterionType` 및 `CriterionTemplate`/`CriterionTemplateItem` 모델 제거)
- Create: `prisma/migrations/20260702120000_criteria_3level_cleanup/migration.sql`

**Interfaces:**
- Consumes: Task 4~8에서 구컬럼 참조가 모두 제거된 상태.

- [ ] **Step 1: 잔존 참조 확인**

Run: `grep -rn "gradeOptions\|CriterionType\|\.section\b\|QUALITATIVE\|criterionTemplate" app components lib scripts --include="*.ts" --include="*.tsx"`
Expected: 실사용 매치 없음(있으면 먼저 정리). `lib/scoring.ts`의 `gradeOptions`/`GRADE_*` 관련 dead export는 남겨도 되나, 이 태스크에서 사용처가 없으면 함께 제거 권장.

- [ ] **Step 2: schema.prisma 정리**

`Criterion`에서 `section/description/type/gradeOptions` 제거, `subitemId String`(필수)·`subitem CriterionSubitem @relation(...)`로. `enum CriterionType` 삭제. `CriterionTemplate`·`CriterionTemplateItem` 모델 삭제.

- [ ] **Step 3: 정리 마이그레이션 SQL**

`prisma/migrations/20260702120000_criteria_3level_cleanup/migration.sql`:
```sql
ALTER TABLE "Criterion" ALTER COLUMN "subitemId" SET NOT NULL;
ALTER TABLE "Criterion" DROP COLUMN "section";
ALTER TABLE "Criterion" DROP COLUMN "description";
ALTER TABLE "Criterion" DROP COLUMN "type";
ALTER TABLE "Criterion" DROP COLUMN "gradeOptions";
DROP TABLE "CriterionTemplateItem";
DROP TABLE "CriterionTemplate";
DROP TYPE "CriterionType";
```

- [ ] **Step 4: 적용 + 생성 + 풀 빌드/테스트**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx prisma migrate deploy && npx prisma generate
npm run build && npm test && npm run test:core
```
Expected: 마이그레이션 적용, `✓ Compiled successfully`, 단위·core-e2e 전부 통과.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor(criteria): 구 2단계 컬럼/enum/템플릿 제거(3단계 정리 마이그레이션)"
```

---

## Self-Review (완료)

- **Spec 커버리지:** 3단계 모델(Task 1,9) · 자동 이관(Task 2) · authoring UI(Task 4) · 배점 상한(Task 5) · 합계 경고(Task 3,4) · 집계 표시(Task 6) · 임포트 어댑터(Task 7) · 정성 제거(Task 5,9) · 테스트/시드(Task 3,8). 누락 없음.
- **플레이스홀더:** 임계 로직(스키마/SQL/백필/헬퍼/액션/검증)은 완전한 코드 제공. 대형 UI(CriteriaEditor·ScoreForm)는 파일 경로·props·동작 계약·핵심 스니펫으로 명세(구현자는 실제 파일을 읽고 작성).
- **타입 일관성:** 리프 `Criterion.id`가 채점 키로 전 구간 일관. 액션 시그니처(add/update/delete × group/subitem/criterion)와 `CriteriaEditor` DTO 일치. `groupTotal/isGroupBalanced` 이름 일치.
- **순서 안전성:** 가산(1) → 백필(2) → 소비자 이전(4~8) → 파괴(9). 매 태스크 빌드 green(구컬럼은 9까지 유지).
