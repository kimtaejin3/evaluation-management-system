'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { initialAssignmentStatus } from '@/lib/assignment'
import { saveUpload, deleteUpload, isPdf } from '@/lib/storage'
import { canCloseSession, CLOSE_BLOCKED_MESSAGE } from '@/lib/session-rules'
import { randomUUID } from 'crypto'
import { hashPassword } from '@/lib/auth'
import { buildCriteria, type ColumnMapping, type BuildOptions } from '@/lib/kpass-import'
import { buildEvaluators, type EvalColumnMapping } from '@/lib/evaluator-import'
import { passwordFromPhone } from '@/lib/phone'
import { buildSubjects, type SubjectColumnMapping } from '@/lib/subject-import'
import { parseSheet } from '@/lib/kpass-sheet'
import { assertSessionAccess, assertProjectAccess, requireAdminUser, assertMaster } from '@/lib/authz'

export async function createSession(formData: FormData) {
  const user = await requireAdminUser()
  const name = String(formData.get('name') ?? '').trim()
  const projectId = String(formData.get('projectId') ?? '').trim()
  if (!name || !projectId) return
  // 과제 접근 권한 검증(간사는 배정된 과제만)
  await assertProjectAccess(projectId)
  const startDate = formData.get('startDate') ? new Date(String(formData.get('startDate'))) : null
  const endDate = formData.get('endDate') ? new Date(String(formData.get('endDate'))) : null
  const eventDate = formData.get('eventDate') ? new Date(String(formData.get('eventDate'))) : null
  const session = await prisma.evaluationSession.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      startDate,
      endDate,
      eventDate,
      projectId,
      // 간사가 만들면 본인이 담당, 마스터가 만들면 폼의 secretaryId(선택)
      secretaryId: user.role === 'SECRETARY' ? user.id : (String(formData.get('secretaryId') ?? '') || null),
    },
  })
  redirect(`/admin/sessions/${session.id}`)
}

// 심사 삭제 — criteria/subjects/assignments/scores는 Cascade.
// 이 심사 전용 자료(sessionId 지정)는 파일까지 함께 삭제, 공통 자료(sessionId=null)는 보존.
// Opinion·EditingPresence는 관계가 없어 별도 정리.
export async function deleteSession(sessionId: string) {
  await assertSessionAccess(sessionId)
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  const docs = await prisma.document.findMany({ where: { sessionId } })
  for (const d of docs) {
    await deleteUpload(d.storedName, d.url)
  }
  await prisma.document.deleteMany({ where: { sessionId } })
  await prisma.opinion.deleteMany({ where: { sessionId } })
  await prisma.editingPresence.deleteMany({ where: { sessionId } })
  await prisma.evaluationSession.delete({ where: { id: sessionId } })
  // 사이드바(admin 레이아웃)의 분과·과제 목록까지 갱신
  revalidatePath('/admin', 'layout')
  // 삭제된 분과 페이지에 머물면 404가 되므로 소속 과제(또는 분과 목록)로 이동
  redirect(session?.projectId ? `/admin/projects/${session.projectId}` : '/admin/sessions')
}

export async function setSessionStatus(sessionId: string, status: 'DRAFT' | 'IN_PROGRESS' | 'CLOSED') {
  await assertSessionAccess(sessionId)
  if (status === 'CLOSED') {
    const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { eventDate: true } })
    if (s && !canCloseSession(s.eventDate)) {
      throw new Error(CLOSE_BLOCKED_MESSAGE)
    }
  }
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status } })
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// ── 평가항목(그룹) ──
export async function addGroup(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const count = await prisma.criterionGroup.count({ where: { sessionId } })
  await prisma.criterionGroup.create({ data: { sessionId, name, maxScore, order: count } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

// 분과 기준 만점 수정(집계 환산 분모). 평가항목 배점 합계가 이 값과 일치해야 함.
export async function updateSessionMaxScore(sessionId: string, maxScore: number) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const v = Math.round(Number(maxScore))
  if (!Number.isFinite(v) || v <= 0) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { maxScore: v } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}
export async function updateGroup(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  const { user } = await assertSessionAccess(g.sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterionGroup.update({ where: { id: groupId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
export async function deleteGroup(groupId: string) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  const { user } = await assertSessionAccess(g.sessionId)
  if (user.role === 'MASTER') return
  await prisma.criterionGroup.delete({ where: { id: groupId } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
// ── 세부항목 ──
export async function addSubitem(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  const { user } = await assertSessionAccess(g.sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const count = await prisma.criterionSubitem.count({ where: { groupId } })
  await prisma.criterionSubitem.create({ data: { groupId, name, order: count } })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}

// 세부항목 + 첫 평가지표를 한 번에 생성(세트). 세부항목명(name) + 평가지표명(criterionName) + 배점(maxScore).
export async function addSubitemWithCriterion(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { sessionId: true } })
  if (!g) return
  const { user } = await assertSessionAccess(g.sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  const criterionName = String(formData.get('criterionName') ?? '').trim()
  if (!name || !criterionName) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const subCount = await prisma.criterionSubitem.count({ where: { groupId } })
  const subitem = await prisma.criterionSubitem.create({ data: { groupId, name, order: subCount } })
  const critCount = await prisma.criterion.count({ where: { sessionId: g.sessionId } })
  await prisma.criterion.create({
    data: { sessionId: g.sessionId, subitemId: subitem.id, name: criterionName, maxScore, order: critCount },
  })
  revalidatePath(`/admin/sessions/${g.sessionId}/criteria`)
}
export async function updateSubitem(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  const { user } = await assertSessionAccess(s.group.sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (name) await prisma.criterionSubitem.update({ where: { id: subitemId }, data: { name } })
  revalidatePath(`/admin/sessions/${s.group.sessionId}/criteria`)
}
export async function deleteSubitem(subitemId: string) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  const { user } = await assertSessionAccess(s.group.sessionId)
  if (user.role === 'MASTER') return
  await prisma.criterionSubitem.delete({ where: { id: subitemId } })
  revalidatePath(`/admin/sessions/${s.group.sessionId}/criteria`)
}
// ── 평가지표(리프) ──
export async function addCriterion(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { sessionId: true } } } })
  if (!s) return
  const sessionId = s.group.sessionId
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
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
  const { user } = await assertSessionAccess(c.sessionId)
  if (user.role === 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterion.update({ where: { id: criterionId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidatePath(`/admin/sessions/${c.sessionId}/criteria`)
}
export async function deleteCriterion(criterionId: string) {
  const c = await prisma.criterion.findUnique({ where: { id: criterionId }, select: { sessionId: true } })
  if (!c) return
  const { user } = await assertSessionAccess(c.sessionId)
  if (user.role === 'MASTER') return
  await prisma.criterion.delete({ where: { id: criterionId } })
  revalidatePath(`/admin/sessions/${c.sessionId}/criteria`)
}

// ── 평가항목 검토 워크플로: 간사 제출 → 관리자 승인/반려 ──
// 간사 제출 → 관리자 검토 대기(SUBMITTED). 관리자는 조회만이므로 MASTER는 차단. 항목이 없으면 제출 불가.
export async function submitCriteria(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const count = await prisma.criterion.count({ where: { sessionId } })
  if (count === 0) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { criteriaStatus: 'SUBMITTED', criteriaRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 간사 제출 취소 → 다시 입력중(DRAFT). 관리자 승인/반려 전(SUBMITTED)에만 가능.
export async function cancelSubmitCriteria(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { criteriaStatus: true } })
  if (!s || s.criteriaStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { criteriaStatus: 'DRAFT' } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 관리자 평가항목 승인(SUBMITTED → APPROVED). 마스터 전용.
export async function approveCriteria(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { criteriaStatus: true } })
  if (!s || s.criteriaStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { criteriaStatus: 'APPROVED', criteriaRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 관리자 평가항목 반려(SUBMITTED → REJECTED) + 사유. 간사가 재작성/재제출. 마스터 전용.
export async function rejectCriteria(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = (reason ?? '').trim()
  if (!trimmed) return
  // 제출(SUBMITTED)뿐 아니라 승인(APPROVED) 이후에도 관리자가 다시 반려할 수 있다(간사 재수정).
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { criteriaStatus: true } })
  if (!s || (s.criteriaStatus !== 'SUBMITTED' && s.criteriaStatus !== 'APPROVED')) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { criteriaStatus: 'REJECTED', criteriaRejectionReason: trimmed },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// ── 평가표 엑셀 임포트(파일 업로드 + 복붙) ──
// 클라이언트가 격자(string[][]) + 사용자 확정 매핑 + 옵션을 보내면, 서버가 동일 순수 로직으로
// 검증 후 일괄 생성한다. 미리보기는 클라에서 같은 lib로 즉시 계산. 엑셀 파일은 parseSheetUpload로 격자화.
export interface KpassImportPayload {
  grid: string[][]
  mapping: ColumnMapping
  hasHeader: boolean
  typeMode: BuildOptions['typeMode']
  replaceCriteria: boolean
}

export interface KpassImportResult {
  ok: boolean
  created?: number
  error?: string
  warnings?: string[]
}

// 업로드된 엑셀 파일 → 격자(string[][]). 미리보기/매핑은 클라에서 이 격자로 진행.
export async function parseSheetUpload(formData: FormData): Promise<{ grid: string[][]; error?: string }> {
  await requireAdminUser()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { grid: [], error: '파일이 없습니다.' }
  if (file.size > 4 * 1024 * 1024) return { grid: [], error: '파일이 너무 큽니다(최대 4MB).' }
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    return { grid: parseSheet(buf) }
  } catch {
    return { grid: [], error: '엑셀 파일을 읽지 못했습니다. .xlsx/.xls/.csv 형식인지 확인하세요.' }
  }
}

export async function commitKpassImport(sessionId: string, payload: KpassImportPayload): Promise<KpassImportResult> {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return { ok: false, error: '가져오기는 담당 간사만 가능합니다.' }
  const grid = payload.grid ?? []
  if (grid.length === 0) return { ok: false, error: '가져올 내용이 없습니다.' }

  // buildCriteria는 여전히 평탄한 초안(CriterionDraft[])을 반환한다(변경 없음).
  // 등급열(type/gradeOptions)은 숫자 전용 임포트라 무시하고, section/name/description/maxScore/weight만
  // 항목(그룹)→세부항목→평가지표(리프) 3단으로 변환해 반영한다.
  const { rows, warnings } = buildCriteria(grid, payload.mapping, {
    hasHeader: payload.hasHeader,
    typeMode: payload.typeMode,
  })
  if (rows.length === 0) {
    return { ok: false, error: warnings[0] ?? '가져올 항목이 없습니다.', warnings }
  }

  // 점수가 이미 입력된 세션은 기존 항목 대체 금지(데이터 보호)
  if (payload.replaceCriteria) {
    const scoreCount = await prisma.score.count({ where: { sessionId } })
    if (scoreCount > 0) {
      return { ok: false, error: '이미 채점이 시작된 심사라 기존 평가항목을 대체할 수 없습니다. "기존 항목 대체"를 해제하고 추가하세요.' }
    }
  }

  // draft.section(첫 등장 순, null/빈값 → '기타') 별로 그룹을 묶는다. 트랜잭션 밖에서 준비.
  type GroupBucket = { section: string; leaves: typeof rows }
  const buckets: GroupBucket[] = []
  const bucketBySection = new Map<string, GroupBucket>()
  for (const r of rows) {
    const section = r.section?.trim() || '기타'
    let bucket = bucketBySection.get(section)
    if (!bucket) {
      bucket = { section, leaves: [] }
      bucketBySection.set(section, bucket)
      buckets.push(bucket)
    }
    bucket.leaves.push(r)
  }

  await prisma.$transaction(
    async (tx) => {
      let groupOrder: number
      let criterionOrder: number
      if (payload.replaceCriteria) {
        // CriterionGroup 삭제 → cascade로 하위 CriterionSubitem/Criterion/Score까지 함께 삭제
        await tx.criterionGroup.deleteMany({ where: { sessionId } })
        groupOrder = 0
        criterionOrder = 0
      } else {
        groupOrder = await tx.criterionGroup.count({ where: { sessionId } })
        criterionOrder = await tx.criterion.count({ where: { sessionId } })
      }

      for (const bucket of buckets) {
        const group = await tx.criterionGroup.create({
          data: {
            sessionId,
            name: bucket.section,
            maxScore: bucket.leaves.reduce((sum, r) => sum + r.maxScore, 0),
            order: groupOrder++,
          },
        })

        let subitemOrder = 0
        for (const r of bucket.leaves) {
          const subitem = await tx.criterionSubitem.create({
            data: { groupId: group.id, name: r.name, order: subitemOrder++ },
          })
          await tx.criterion.create({
            data: {
              sessionId,
              subitemId: subitem.id,
              name: r.description || r.name,
              maxScore: r.maxScore,
              weight: r.weight ?? 1,
              order: criterionOrder++,
            },
          })
        }
      }
    },
    { timeout: 20000 },
  )

  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  return { ok: true, created: rows.length, warnings }
}

// ── 평가위원 명단 엑셀 임포트(파일 업로드 + 복붙) ──
// 행마다: username 있으면 그 키로 계정 upsert(기존 비번 유지), 없으면 자동 생성 + 임시비번 발급.
// 모든 위원을 이 심사에 배정. 결과로 계정·임시비번 목록을 돌려줘 관리자가 안내할 수 있게 한다.
export interface EvaluatorImportPayload {
  grid: string[][]
  mapping: EvalColumnMapping
  hasHeader: boolean
}

export interface ImportedEvaluator {
  name: string
  username: string
  tempPassword: string | null // null = 기존 계정(비번 유지)
}

export interface EvaluatorImportResult {
  ok: boolean
  error?: string
  warnings?: string[]
  accounts?: ImportedEvaluator[]
}

function genUsername(): string {
  return 'ev' + randomUUID().replace(/-/g, '').slice(0, 6)
}
function genPassword(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8)
}

export async function commitEvaluatorImport(
  sessionId: string,
  payload: EvaluatorImportPayload,
): Promise<EvaluatorImportResult> {
  await assertSessionAccess(sessionId)
  const grid = payload.grid ?? []
  if (grid.length === 0) return { ok: false, error: '가져올 내용이 없습니다.' }

  const { rows, warnings } = buildEvaluators(grid, payload.mapping, { hasHeader: payload.hasHeader })
  if (rows.length === 0) return { ok: false, error: warnings[0] ?? '가져올 위원이 없습니다.', warnings }

  // 비밀번호 해시(bcrypt)는 느려서 트랜잭션 안에서 돌리면 타임아웃을 유발한다.
  // → 트랜잭션 밖에서 조회·해시를 미리 끝내고, 트랜잭션에선 빠른 쓰기만 한다.
  const prepared = await Promise.all(
    rows.map(async (r) => {
      const username = r.username || genUsername()
      const existing = await prisma.user.findUnique({ where: { username }, select: { id: true, name: true } })
      if (existing) {
        return { kind: 'existing' as const, username, name: r.name, phone: r.phone, id: existing.id, nameChanged: existing.name !== r.name }
      }
      // 임시 비밀번호 = 연락처 끝 4자리(연락처는 임포트에서 필수). 4자리 미만 등 예외 시에만 자동 생성.
      const pw = passwordFromPhone(r.phone) ?? genPassword()
      return { kind: 'new' as const, username, name: r.name, phone: r.phone, pw, hash: await hashPassword(pw) }
    }),
  )

  const accounts: ImportedEvaluator[] = []
  await prisma.$transaction(
    async (tx) => {
      for (const p of prepared) {
        let userId: string
        let tempPassword: string | null = null
        if (p.kind === 'existing') {
          userId = p.id
          // 이름 변경 또는 연락처 제공 시 갱신
          if (p.nameChanged || p.phone) await tx.user.update({ where: { id: p.id }, data: { name: p.name, phone: p.phone ?? undefined } })
        } else {
          const created = await tx.user.create({
            data: { username: p.username, name: p.name, phone: p.phone, role: 'EVALUATOR', passwordHash: p.hash, tempPassword: p.pw },
          })
          userId = created.id
          tempPassword = p.pw
        }
        await tx.assignment.upsert({
          where: { sessionId_userId: { sessionId, userId } },
          update: {},
          create: { sessionId, userId },
        })
        accounts.push({ name: p.name, username: p.username, tempPassword })
      }
    },
    { timeout: 20000 },
  )

  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
  revalidatePath('/admin/evaluators')
  return { ok: true, accounts, warnings }
}

// ── 평가 대상(기업) 명단 엑셀 임포트(파일 업로드 + 복붙) ──
// 행마다: 기업 upsert(by 기업명, 사업자번호·설명 갱신) + 이 분과에 평가 대상으로 편입(중복 스킵).
export interface SubjectImportPayload {
  grid: string[][]
  mapping: SubjectColumnMapping
  hasHeader: boolean
}

export interface SubjectImportResult {
  ok: boolean
  created?: number
  skipped?: number
  error?: string
  warnings?: string[]
}

export async function commitSubjectImport(
  sessionId: string,
  payload: SubjectImportPayload,
): Promise<SubjectImportResult> {
  await assertSessionAccess(sessionId)
  const grid = payload.grid ?? []
  if (grid.length === 0) return { ok: false, error: '가져올 내용이 없습니다.' }

  const { rows, warnings } = buildSubjects(grid, payload.mapping, { hasHeader: payload.hasHeader })
  if (rows.length === 0) return { ok: false, error: warnings[0] ?? '가져올 평가 대상이 없습니다.', warnings }

  let created = 0
  let skipped = 0
  await prisma.$transaction(
    async (tx) => {
      let order = await tx.subject.count({ where: { sessionId } })
      for (const r of rows) {
        const company = await tx.company.upsert({
          where: { name: r.name },
          update: { businessNo: r.businessNo ?? undefined, description: r.description ?? undefined },
          create: { name: r.name, businessNo: r.businessNo, description: r.description },
        })
        const exists = await tx.subject.findUnique({
          where: { sessionId_companyId: { sessionId, companyId: company.id } },
        })
        if (exists) {
          skipped++
          continue
        }
        await tx.subject.create({
          data: { sessionId, companyId: company.id, name: company.name, description: company.description, order: order++ },
        })
        created++
      }
    },
    { timeout: 20000 },
  )

  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  revalidatePath('/admin/companies')
  return { ok: true, created, skipped, warnings }
}

// 심사에 평가 대상(기업) 편입 — 신규 기업 정보(newName)를 직접 입력해 등록. 간사 전용(관리자는 조회만).
// 평가 대상은 검토 제출 전(DRAFT/REJECTED)에만 간사가 수정할 수 있다(SUBMITTED/APPROVED는 잠금).
async function subjectsEditable(sessionId: string): Promise<boolean> {
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { subjectReviewStatus: true } })
  return !!s && (s.subjectReviewStatus === 'DRAFT' || s.subjectReviewStatus === 'REJECTED')
}

export async function addSubject(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  if (!(await subjectsEditable(sessionId))) return
  const newName = String(formData.get('newName') ?? '').trim()
  if (!newName) return

  // 신규 기업 등록 시 인쇄 헤더용 지역·연구책임자 필수, 사업자등록번호는 선택
  const region = String(formData.get('region') ?? '').trim()
  const leadResearcher = String(formData.get('leadResearcher') ?? '').trim()
  const businessNo = String(formData.get('businessNo') ?? '').trim()
  if (!region || !leadResearcher) return
  const company = await prisma.company.upsert({
    where: { name: newName },
    update: { region, leadResearcher, businessNo: businessNo || undefined },
    create: { name: newName, region, leadResearcher, businessNo: businessNo || null },
  })

  // 같은 심사에 이미 편입된 기업이면 정보 수정으로 간주 — 재검토를 위해 PENDING으로 되돌림
  const exists = await prisma.subject.findUnique({
    where: { sessionId_companyId: { sessionId, companyId: company.id } },
  })
  if (exists) {
    await prisma.subject.update({
      where: { id: exists.id },
      data: { status: 'PENDING', rejectionReason: null, decidedAt: null },
    })
    revalidatePath(`/admin/sessions/${sessionId}/subjects`)
    return
  }

  const count = await prisma.subject.count({ where: { sessionId } })
  await prisma.subject.create({
    data: {
      sessionId,
      companyId: company.id,
      name: company.name,
      description: company.description,
      order: count,
      status: 'PENDING',
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

// 반려된(또는 기존) 평가 대상의 기업 정보 수정 — 간사 전용. 수정 시 재검토를 위해 PENDING으로 되돌림.
export async function editSubject(sessionId: string, subjectId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  if (!(await subjectsEditable(sessionId))) return
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
  if (!subject || subject.sessionId !== sessionId) return

  const region = String(formData.get('region') ?? '').trim()
  const leadResearcher = String(formData.get('leadResearcher') ?? '').trim()
  const businessNo = String(formData.get('businessNo') ?? '').trim()
  if (!region || !leadResearcher) return

  await prisma.company.update({
    where: { id: subject.companyId },
    data: { region, leadResearcher, businessNo: businessNo || null },
  })
  await prisma.subject.update({
    where: { id: subjectId },
    data: { status: 'PENDING', rejectionReason: null, decidedAt: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteSubject(sessionId: string, subjectId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return // 관리자는 조회만
  if (!(await subjectsEditable(sessionId))) return
  await prisma.subject.delete({ where: { id: subjectId } })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

// 평가 대상(기업) 자료 업로드 — 이 심사 전용(sessionId)으로 저장. 사업계획/현장실태조사서/사전검토표 등. 간사 전용.
export async function uploadSubjectDocument(sessionId: string, companyId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  if (!(await subjectsEditable(sessionId))) return
  // PDF만 허용
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0 && isPdf(f))
  if (files.length === 0) return
  for (const file of files) {
    const { storedName, url } = await saveUpload(file)
    await prisma.document.create({
      data: {
        companyId,
        sessionId,
        originalName: file.name,
        storedName,
        url,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    })
  }
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteSubjectDocument(sessionId: string, documentId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return // 관리자는 조회만
  if (!(await subjectsEditable(sessionId))) return
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  await deleteUpload(doc.storedName, doc.url)
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function removeEvaluator(sessionId: string, userId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return // 관리자는 조회·승인만
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true, chairId: true } })
  // 제출(SUBMITTED)/승인(APPROVED) 상태에서는 배정을 변경할 수 없다(검토 중 잠금)
  if (!s || (s.evaluatorStatus !== 'DRAFT' && s.evaluatorStatus !== 'REJECTED')) return
  await prisma.assignment.delete({ where: { sessionId_userId: { sessionId, userId } } })
  // 배정 해제된 위원이 위원장이었다면 위원장 해제
  if (s.chairId === userId) {
    await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: null } })
  }
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// 평가위원장 지정/해제 — 배정된 위원 중 1인. userId 비우면 해제.
export async function setChair(sessionId: string, formData: FormData) {
  await assertSessionAccess(sessionId)
  const userId = String(formData.get('userId') ?? '').trim()
  if (userId) {
    // 배정된 위원만 위원장이 될 수 있음
    const assigned = await prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
    if (!assigned) return
  }
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: userId || null } })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// 전역 풀의 기존 위원을 이 분과에 배정(폼: userId). 간사 전용, 배정중(DRAFT/REJECTED)에만. 배정은 PENDING.
export async function assignEvaluator(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return // 관리자는 배정하지 않음(승인만)
  // 제출(SUBMITTED)/승인(APPROVED) 상태에서는 배정을 추가할 수 없다(검토 중 잠금)
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true } })
  if (!s || (s.evaluatorStatus !== 'DRAFT' && s.evaluatorStatus !== 'REJECTED')) return
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


// 담당 간사(+마스터)가 제출완료 평가를 승인
export async function approveEvaluation(sessionId: string, subjectId: string, evaluatorId: string) {
  const { user } = await assertSessionAccess(sessionId)
  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    select: { status: true, sessionId: true },
  })
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
  const sub = await prisma.submission.findUnique({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    select: { status: true, sessionId: true },
  })
  if (!sub || sub.sessionId !== sessionId || sub.status !== 'SUBMITTED') return
  await prisma.submission.update({
    where: { evaluatorId_subjectId: { evaluatorId, subjectId } },
    data: { status: 'REJECTED', decidedAt: new Date(), decidedById: user.id },
  })
  revalidatePath(`/admin/sessions/${sessionId}/progress`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}

// ── 관리자: 배정 위원 승인/반려/검토완료 (MASTER 전용) ──

export async function approveAssignment(sessionId: string, userId: string) {
  await assertMaster()
  // updateMany: 대상 배정이 이미 삭제됐거나(레이스) 없으면 조용히 무시(P2025 방지)
  await prisma.assignment.updateMany({
    where: { sessionId, userId },
    data: { status: 'APPROVED', decidedAt: new Date() },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

export async function rejectAssignment(sessionId: string, userId: string) {
  await assertMaster()
  // updateMany: 대상 배정이 이미 삭제됐거나(레이스) 없으면 조용히 무시(P2025 방지)
  await prisma.assignment.updateMany({
    where: { sessionId, userId },
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

// 이 분과의 배정 위원 전체 반려(사유 필수) — 상단 관리자 검토 패널(마스터 전용)
export async function rejectAllAssignments(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = reason.trim()
  if (!trimmed) return
  await prisma.assignment.updateMany({
    where: { sessionId },
    data: { status: 'REJECTED', rejectionReason: trimmed, decidedAt: new Date() },
  })
  // 위원장의 배정도 함께 반려됐다면 위원장 해제
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { chairId: true } })
  if (s?.chairId) {
    await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: null } })
  }
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// ── 평가위원 배정 검토 워크플로: 간사 제출 → 관리자 승인/반려 ──
// 간사 제출 → 관리자 검토 대기(SUBMITTED). 관리자는 조회만이므로 MASTER는 차단. 배정이 없으면 제출 불가.
export async function submitEvaluators(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const count = await prisma.assignment.count({ where: { sessionId } })
  if (count === 0) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { evaluatorStatus: 'SUBMITTED', evaluatorRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 간사 제출 취소 → 다시 배정중(DRAFT). 관리자 승인/반려 전(SUBMITTED)에만 가능.
export async function cancelSubmitEvaluators(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true } })
  if (!s || s.evaluatorStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { evaluatorStatus: 'DRAFT' } })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 관리자 배정 승인(SUBMITTED → APPROVED). 배정 위원 전체를 활성화(APPROVED)해 평가에 참여시킨다. 마스터 전용.
export async function approveEvaluators(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true } })
  if (!s || s.evaluatorStatus !== 'SUBMITTED') return
  await prisma.$transaction([
    prisma.assignment.updateMany({
      where: { sessionId },
      data: { status: 'APPROVED', rejectionReason: null, decidedAt: new Date() },
    }),
    prisma.evaluationSession.update({
      where: { id: sessionId },
      data: { evaluatorStatus: 'APPROVED', evaluatorRejectionReason: null },
    }),
  ])
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 관리자 배정 반려(SUBMITTED → REJECTED) + 사유. 간사가 위원을 조정 후 재제출. 마스터 전용.
export async function rejectEvaluators(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = (reason ?? '').trim()
  if (!trimmed) return
  // 승인(APPROVED) 이후에도 반려 가능. 승인으로 활성화됐던 배정은 다시 대기(PENDING)로 되돌려 비활성화한다.
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true } })
  if (!s || (s.evaluatorStatus !== 'SUBMITTED' && s.evaluatorStatus !== 'APPROVED')) return
  await prisma.$transaction([
    prisma.assignment.updateMany({ where: { sessionId, status: 'APPROVED' }, data: { status: 'PENDING', decidedAt: null } }),
    prisma.evaluationSession.update({
      where: { id: sessionId },
      data: { evaluatorStatus: 'REJECTED', evaluatorRejectionReason: trimmed },
    }),
  ])
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// 간사(담당) 집계결과 '제출 완료' → 관리자 검토 대기. 관리자는 조회만이므로 MASTER는 차단.
export async function submitSessionForReview(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { submittedForReviewAt: new Date() },
  })
  revalidatePath(`/admin/sessions/${sessionId}`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}

// 간사 제출 취소(관리자 검토 완료 전까지). 마감(CLOSED)된 분과는 되돌릴 수 없다.
export async function cancelSubmitSessionForReview(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  if (!s || s.status === 'CLOSED') return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { submittedForReviewAt: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}

// 관리자 검토 완료 → 분과 완료(CLOSED). 사전 조건: 간사가 '제출 완료'했어야 함(submittedForReviewAt).
// eventDate 마감 가드(canCloseSession)는 의도적으로 건너뛴다(스펙상 검토 완료엔 사전 마감조건 없음).
export async function completeReview(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { submittedForReviewAt: true } })
  if (!s || s.submittedForReviewAt == null) return // 간사 제출 전에는 검토 완료 불가
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status: 'CLOSED' } })
  revalidatePath(`/admin/sessions/${sessionId}`)
  revalidatePath(`/admin/sessions/${sessionId}/results`)
}

// ── 관리자: 평가 대상(기업) 일괄 승인/반려 (MASTER 전용) ──

export async function approveSubjects(sessionId: string) {
  await assertMaster()
  await prisma.subject.updateMany({
    where: { sessionId },
    data: { status: 'APPROVED', decidedAt: new Date(), rejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function rejectSubjects(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = reason.trim()
  if (!trimmed) return
  await prisma.subject.updateMany({
    where: { sessionId },
    data: { status: 'REJECTED', rejectionReason: trimmed, decidedAt: new Date() },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

// ── 평가 대상 검토 워크플로: 간사 제출 → 관리자 승인/반려 (세션 단위) ──
export async function submitSubjectReview(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const count = await prisma.subject.count({ where: { sessionId } })
  if (count === 0) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { subjectReviewStatus: 'SUBMITTED', subjectReviewRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function cancelSubmitSubjectReview(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { subjectReviewStatus: true } })
  if (!s || s.subjectReviewStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { subjectReviewStatus: 'DRAFT' } })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function approveSubjectReview(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { subjectReviewStatus: true } })
  if (!s || s.subjectReviewStatus !== 'SUBMITTED') return
  await prisma.$transaction([
    prisma.subject.updateMany({ where: { sessionId }, data: { status: 'APPROVED', decidedAt: new Date(), rejectionReason: null } }),
    prisma.evaluationSession.update({ where: { id: sessionId }, data: { subjectReviewStatus: 'APPROVED', subjectReviewRejectionReason: null } }),
  ])
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function rejectSubjectReview(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = (reason ?? '').trim()
  if (!trimmed) return
  // 승인(APPROVED) 이후에도 반려 가능. 승인 표시됐던 대상은 대기(PENDING)로 되돌린다.
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { subjectReviewStatus: true } })
  if (!s || (s.subjectReviewStatus !== 'SUBMITTED' && s.subjectReviewStatus !== 'APPROVED')) return
  await prisma.$transaction([
    prisma.subject.updateMany({ where: { sessionId, status: 'APPROVED' }, data: { status: 'PENDING', decidedAt: null } }),
    prisma.evaluationSession.update({
      where: { id: sessionId },
      data: { subjectReviewStatus: 'REJECTED', subjectReviewRejectionReason: trimmed },
    }),
  ])
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

// ── 평가 의견서 검토 워크플로: 간사 제출 → 관리자 승인/반려 (세션 단위) ──
export async function submitOpinions(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const count = await prisma.opinion.count({ where: { sessionId, text: { not: '' } } })
  if (count === 0) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { opinionStatus: 'SUBMITTED', opinionRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/opinions`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function cancelSubmitOpinions(sessionId: string) {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { opinionStatus: true } })
  if (!s || s.opinionStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { opinionStatus: 'DRAFT' } })
  revalidatePath(`/admin/sessions/${sessionId}/opinions`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function approveOpinions(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { opinionStatus: true } })
  if (!s || s.opinionStatus !== 'SUBMITTED') return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { opinionStatus: 'APPROVED', opinionRejectionReason: null },
  })
  revalidatePath(`/admin/sessions/${sessionId}/opinions`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function rejectOpinions(sessionId: string, reason: string) {
  await assertMaster()
  const trimmed = (reason ?? '').trim()
  if (!trimmed) return
  // 승인(APPROVED) 이후에도 반려 가능.
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { opinionStatus: true } })
  if (!s || (s.opinionStatus !== 'SUBMITTED' && s.opinionStatus !== 'APPROVED')) return
  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { opinionStatus: 'REJECTED', opinionRejectionReason: trimmed },
  })
  revalidatePath(`/admin/sessions/${sessionId}/opinions`)
  revalidatePath(`/admin/sessions/${sessionId}`)
}
