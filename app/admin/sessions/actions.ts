'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { initialAssignmentStatus } from '@/lib/assignment'
import { saveUpload, deleteUpload, isPdf, r2Enabled, presignR2Upload, headR2Upload } from '@/lib/storage'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/upload-limits'
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
  // 사업 접근 권한 검증(담당자는 배정된 사업만)
  await assertProjectAccess(projectId)
  // 분과 평가 기간(시작일/종료일) — 소속 사업 기간 안에 있어야 한다.
  const startRaw = String(formData.get('startDate') ?? '').trim()
  const endRaw = String(formData.get('endDate') ?? '').trim()
  if (!startRaw || !endRaw) return
  const startDate = new Date(startRaw)
  const endDate = new Date(endRaw)
  if (endDate < startDate) return
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { startDate: true, endDate: true } })
  if (project?.startDate && startDate < project.startDate) return
  if (project?.endDate && endDate > project.endDate) return
  const session = await prisma.evaluationSession.create({
    data: {
      name,
      description: String(formData.get('description') ?? '') || null,
      startDate,
      endDate,
      // eventDate는 마감 판정·평가화면 안내용 — 종료일과 동기화 유지
      eventDate: endDate,
      projectId,
      // 담당자가 만들면 본인이 담당, 마스터가 만들면 폼의 secretaryId(선택)
      secretaryId: user.role === 'SECRETARY' ? user.id : (String(formData.get('secretaryId') ?? '') || null),
    },
  })
  // 사이드바(담당자 분과 트리·사업 화면)까지 즉시 반영
  revalidatePath('/admin', 'layout')
  redirect(`/admin/sessions/${session.id}`)
}

// 심사 삭제 — criteria/subjects/assignments/scores는 Cascade.
// 이 심사 전용 자료(sessionId 지정)는 파일까지 함께 삭제, 공통 자료(sessionId=null)는 보존.
// Opinion·EditingPresence는 관계가 없어 별도 정리.
// 분과 삭제 공통 — 자료(PDF)·의견·입력중 표시 정리 후 세션 삭제(나머지는 스키마 cascade).
async function purgeSession(sessionId: string) {
  const docs = await prisma.document.findMany({ where: { sessionId } })
  for (const d of docs) {
    await deleteUpload(d.storedName, d.url)
  }
  await prisma.document.deleteMany({ where: { sessionId } })
  await prisma.opinion.deleteMany({ where: { sessionId } })
  await prisma.editingPresence.deleteMany({ where: { sessionId } })
  await prisma.evaluationSession.delete({ where: { id: sessionId } })
}

export async function deleteSession(sessionId: string) {
  await assertSessionAccess(sessionId)
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  await purgeSession(sessionId)
  // 사이드바(admin 레이아웃)의 분과·사업 목록까지 갱신
  revalidatePath('/admin', 'layout')
  // 삭제된 분과 페이지에 머물면 404가 되므로 소속 사업(또는 분과 목록)로 이동
  redirect(session?.projectId ? `/admin/projects/${session.projectId}` : '/admin/sessions')
}

// 사업 레벨(실시간 모니터링) 목록에서 분과 삭제 — 목록에 머물러야 하므로 리다이렉트하지 않는다.
export async function deleteSessionFromProject(
  projectId: string,
  sessionId: string,
): Promise<{ ok: boolean }> {
  await assertSessionAccess(sessionId)
  const session = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { projectId: true } })
  if (!session || session.projectId !== projectId) return { ok: false }
  await purgeSession(sessionId)
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}/monitoring`)
  return { ok: true }
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

// ── 평가항목(그룹) — 사업(Project) 단위, 관리자(MASTER) 전용 편집 ──
// 평가항목은 사업의 모든 분과가 공유하므로 관리자가 사업당 1벌을 작성하고, 각 분과 담당자는 '확인'만 한다.
// 평가항목 변경은 사업 페이지 + 소속 분과들의 확인/채점 화면에 두루 영향 → 레이아웃 단위로 갱신.
function revalidateCriteria(projectId: string) {
  revalidatePath('/admin', 'layout')
  revalidatePath(`/admin/projects/${projectId}/criteria`)
}

export async function addGroup(projectId: string, formData: FormData) {
  const { user } = await assertProjectAccess(projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const count = await prisma.criterionGroup.count({ where: { projectId } })
  await prisma.criterionGroup.create({ data: { projectId, name, maxScore, order: count } })
  revalidateCriteria(projectId)
}

// 사업 기준 만점 수정(집계 환산 분모). 평가항목 배점 합계가 이 값과 일치해야 함.
// 분과 집계는 session.maxScore를 쓰므로 소속 분과들에도 동기화한다.
export async function updateProjectMaxScore(projectId: string, maxScore: number) {
  const { user } = await assertProjectAccess(projectId)
  if (user.role !== 'MASTER') return
  const v = Math.round(Number(maxScore))
  if (!Number.isFinite(v) || v <= 0) return
  await prisma.project.update({ where: { id: projectId }, data: { maxScore: v } })
  await prisma.evaluationSession.updateMany({ where: { projectId }, data: { maxScore: v } })
  revalidateCriteria(projectId)
}
export async function updateGroup(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { projectId: true } })
  if (!g?.projectId) return
  const { user } = await assertProjectAccess(g.projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterionGroup.update({ where: { id: groupId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidateCriteria(g.projectId)
}
export async function deleteGroup(groupId: string) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { projectId: true } })
  if (!g?.projectId) return
  const { user } = await assertProjectAccess(g.projectId)
  if (user.role !== 'MASTER') return
  await prisma.criterionGroup.delete({ where: { id: groupId } })
  revalidateCriteria(g.projectId)
}
// ── 세부항목 ──
export async function addSubitem(groupId: string, formData: FormData) {
  const g = await prisma.criterionGroup.findUnique({ where: { id: groupId }, select: { projectId: true } })
  if (!g?.projectId) return
  const { user } = await assertProjectAccess(g.projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const count = await prisma.criterionSubitem.count({ where: { groupId } })
  await prisma.criterionSubitem.create({ data: { groupId, name, order: count } })
  revalidateCriteria(g.projectId)
}

export async function updateSubitem(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({
    where: { id: subitemId },
    select: { maxScore: true, group: { select: { projectId: true } } },
  })
  if (!s?.group.projectId) return
  const { user } = await assertProjectAccess(s.group.projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  // 통합 배점 모드일 때만 통합 배점 수정 허용(모드 전환은 지표 전부 삭제로만)
  const lumpRaw = formData.get('maxScore')
  const lump = lumpRaw == null ? NaN : Number(lumpRaw)
  await prisma.criterionSubitem.update({
    where: { id: subitemId },
    data: {
      ...(name ? { name } : {}),
      ...(s.maxScore != null && Number.isFinite(lump) ? { maxScore: lump } : {}),
    },
  })
  revalidateCriteria(s.group.projectId)
}
export async function deleteSubitem(subitemId: string) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { projectId: true } } } })
  if (!s?.group.projectId) return
  const { user } = await assertProjectAccess(s.group.projectId)
  if (user.role !== 'MASTER') return
  await prisma.criterionSubitem.delete({ where: { id: subitemId } })
  revalidateCriteria(s.group.projectId)
}
// ── 평가지표(리프) ──
// 평가지표 일괄 추가 — 여러 줄을 한 번에 넣고 배점 방식 선택.
// mode 'lump': 세부항목 통합 배점(퉁) — 지표는 설명용(배점 0), 통합 배점(lumpScore)을 세부항목에 저장.
// mode 'per' : 지표별 배점 — 줄마다 배점(scores[i]).
// 이미 방식이 정해진 세부항목(지표 존재 또는 통합 배점 설정)은 저장된 방식을 따른다.
export async function addCriteriaBatch(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({
    where: { id: subitemId },
    select: { maxScore: true, group: { select: { projectId: true } }, _count: { select: { criteria: true } } },
  })
  if (!s?.group.projectId) return
  const projectId = s.group.projectId
  const { user } = await assertProjectAccess(projectId)
  if (user.role !== 'MASTER') return

  const names = formData.getAll('names').map((v) => String(v).trim())
  const scores = formData.getAll('scores').map((v) => Number(v) || 0)
  const rows = names.map((name, i) => ({ name, score: scores[i] ?? 0 })).filter((r) => r.name)
  if (rows.length === 0) return

  const existingMode = s.maxScore != null ? 'lump' : s._count.criteria > 0 ? 'per' : null
  const mode = existingMode ?? (String(formData.get('mode')) === 'lump' ? 'lump' : 'per')
  const lump = Number(formData.get('lumpScore') ?? NaN)
  // 신규 통합 세부항목은 통합 배점이 필수
  if (mode === 'lump' && s.maxScore == null && !Number.isFinite(lump)) return

  let order = await prisma.criterion.count({ where: { projectId } })
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      await tx.criterion.create({
        data: { projectId, subitemId, name: r.name, maxScore: mode === 'per' ? r.score : 0, order: order++ },
      })
    }
    if (mode === 'lump' && Number.isFinite(lump)) {
      await tx.criterionSubitem.update({ where: { id: subitemId }, data: { maxScore: lump } })
    }
  })
  revalidateCriteria(projectId)
}

export async function addCriterion(subitemId: string, formData: FormData) {
  const s = await prisma.criterionSubitem.findUnique({ where: { id: subitemId }, select: { group: { select: { projectId: true } } } })
  if (!s?.group.projectId) return
  const projectId = s.group.projectId
  const { user } = await assertProjectAccess(projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  const count = await prisma.criterion.count({ where: { projectId } })
  await prisma.criterion.create({ data: { projectId, subitemId, name, maxScore, order: count } })
  revalidateCriteria(projectId)
}
export async function updateCriterion(criterionId: string, formData: FormData) {
  const c = await prisma.criterion.findUnique({ where: { id: criterionId }, select: { projectId: true } })
  if (!c?.projectId) return
  const { user } = await assertProjectAccess(c.projectId)
  if (user.role !== 'MASTER') return
  const name = String(formData.get('name') ?? '').trim()
  const maxScore = Number(formData.get('maxScore') ?? 0) || 0
  await prisma.criterion.update({ where: { id: criterionId }, data: { ...(name ? { name } : {}), maxScore } })
  revalidateCriteria(c.projectId)
}
export async function deleteCriterion(criterionId: string) {
  const c = await prisma.criterion.findUnique({
    where: { id: criterionId },
    select: { projectId: true, subitemId: true, subitem: { select: { maxScore: true } } },
  })
  if (!c?.projectId) return
  const { user } = await assertProjectAccess(c.projectId)
  if (user.role !== 'MASTER') return
  await prisma.criterion.delete({ where: { id: criterionId } })
  // 통합 배점 세부항목에서 마지막 지표를 지우면 방식 초기화(다시 선택 가능) + 해당 통합 점수 정리
  if (c.subitem.maxScore != null) {
    const remaining = await prisma.criterion.count({ where: { subitemId: c.subitemId } })
    if (remaining === 0) {
      await prisma.score.deleteMany({ where: { subitemId: c.subitemId } })
      await prisma.criterionSubitem.update({ where: { id: c.subitemId }, data: { maxScore: null } })
    }
  }
  revalidateCriteria(c.projectId)
}

// ── 평가항목 확인: 관리자가 작성한 사업 공통 항목을 담당자가 '확인' ──
// 관리자는 사업 평가항목 페이지에서 분과별 확인 여부(담당자·시각)를 본다.
export async function ackCriteria(sessionId: string) {
  const { user, session } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return
  if (!session.projectId) return
  // 확인할 항목이 없으면 확인 불가
  const count = await prisma.criterion.count({ where: { projectId: session.projectId } })
  if (count === 0) return
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { criteriaAckAt: new Date() } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
  revalidatePath(`/admin/projects/${session.projectId}/criteria`)
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

export async function commitKpassImport(projectId: string, payload: KpassImportPayload): Promise<KpassImportResult> {
  // 평가항목은 사업 단위 — 관리자만 가져올 수 있다.
  const { user } = await assertProjectAccess(projectId)
  if (user.role !== 'MASTER') return { ok: false, error: '가져오기는 관리자만 가능합니다.' }
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

  // 이 사업 항목으로 점수가 이미 입력됐다면 기존 항목 대체 금지(데이터 보호)
  if (payload.replaceCriteria) {
    const scoreCount = await prisma.score.count({ where: { criterion: { projectId } } })
    if (scoreCount > 0) {
      return { ok: false, error: '이미 채점이 시작된 사업라 기존 평가항목을 대체할 수 없습니다. "기존 항목 대체"를 해제하고 추가하세요.' }
    }
  }

  // 평가항목(group) → 세부항목(subitem) → 평가지표(리프) 3단으로 중첩. 첫 등장 순서 보존.
  // group 없으면 '기타', subitem 없으면 평가지표명을 세부항목으로 사용(각 지표가 자기 세부항목).
  type SubBucket = { name: string; leaves: typeof rows }
  type GroupBucket = { name: string; subs: SubBucket[]; subByName: Map<string, SubBucket> }
  const groupBuckets: GroupBucket[] = []
  const groupByName = new Map<string, GroupBucket>()
  for (const r of rows) {
    const gName = r.group?.trim() || '기타'
    const sName = r.subitem?.trim() || r.name
    let g = groupByName.get(gName)
    if (!g) {
      g = { name: gName, subs: [], subByName: new Map() }
      groupByName.set(gName, g)
      groupBuckets.push(g)
    }
    let sub = g.subByName.get(sName)
    if (!sub) {
      sub = { name: sName, leaves: [] }
      g.subByName.set(sName, sub)
      g.subs.push(sub)
    }
    sub.leaves.push(r)
  }

  await prisma.$transaction(
    async (tx) => {
      let groupOrder: number
      let criterionOrder: number
      if (payload.replaceCriteria) {
        // CriterionGroup 삭제 → cascade로 하위 CriterionSubitem/Criterion/Score까지 함께 삭제
        await tx.criterionGroup.deleteMany({ where: { projectId } })
        groupOrder = 0
        criterionOrder = 0
      } else {
        groupOrder = await tx.criterionGroup.count({ where: { projectId } })
        criterionOrder = await tx.criterion.count({ where: { projectId } })
      }

      for (const g of groupBuckets) {
        const group = await tx.criterionGroup.create({
          data: {
            projectId,
            name: g.name,
            maxScore: g.subs.reduce((sum, sub) => sum + sub.leaves.reduce((a, l) => a + l.maxScore, 0), 0),
            order: groupOrder++,
          },
        })

        let subitemOrder = 0
        for (const sub of g.subs) {
          const subitem = await tx.criterionSubitem.create({
            data: { groupId: group.id, name: sub.name, order: subitemOrder++ },
          })
          for (const leaf of sub.leaves) {
            await tx.criterion.create({
              data: {
                projectId,
                subitemId: subitem.id,
                name: leaf.name,
                maxScore: leaf.maxScore,
                weight: leaf.weight ?? 1,
                order: criterionOrder++,
              },
            })
          }
        }
      }
    },
    { timeout: 20000 },
  )

  revalidateCriteria(projectId)
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
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return { ok: false, error: '가져오기는 담당자만 가능합니다.' }
  // 제출 완료(SUBMITTED)/승인(APPROVED) 상태에서는 배정을 변경할 수 없다.
  const es = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { evaluatorStatus: true } })
  if (!es || (es.evaluatorStatus !== 'DRAFT' && es.evaluatorStatus !== 'REJECTED'))
    return { ok: false, error: '제출 완료 상태에서는 가져올 수 없습니다. 제출을 취소한 뒤 다시 시도하세요.' }
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
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return { ok: false, error: '가져오기는 담당자만 가능합니다.' }
  if (!(await subjectsEditable(sessionId)))
    return { ok: false, error: '제출 완료 상태에서는 가져올 수 없습니다. 제출을 취소한 뒤 다시 시도하세요.' }
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

// 심사에 평가 대상(기업) 편입 — 신규 기업 정보(newName)를 직접 입력해 등록. 담당자 전용(관리자는 조회만).
// 평가 대상은 검토 제출 전(DRAFT/REJECTED)에만 담당자가 수정할 수 있다(SUBMITTED/APPROVED는 잠금).
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

// 반려된(또는 기존) 평가 대상의 기업 정보 수정 — 담당자 전용. 수정 시 재검토를 위해 PENDING으로 되돌림.
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

// 평가 대상(기업) 자료 업로드 — 이 심사 전용(sessionId)으로 저장. 사업계획/현장실태조사서/사전검토표 등. 담당자 전용.
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

// ── 브라우저 → R2 직접 업로드(대용량) ─────────────────────────────
// 서버 액션 본문 한도(4MB)를 우회하기 위해 presigned URL로 브라우저가 R2에 바로 PUT한다.
// 흐름: presign(자격·형식·한도 검증 후 URL 발급) → 브라우저 PUT → register(존재·크기 확인 후 DB 등록)

type PresignResult =
  | { direct: true; uploadUrl: string; storedName: string; url: string }
  | { direct: false } // R2 미설정 환경 — 기존 서버 액션 업로드로 폴백
  | { error: string }

export async function presignSubjectUpload(
  sessionId: string,
  fileName: string,
  fileSize: number,
  fileType: string,
): Promise<PresignResult> {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return { error: '담당자만 업로드할 수 있습니다.' }
  if (!(await subjectsEditable(sessionId))) return { error: '제출/승인 상태에서는 자료를 수정할 수 없습니다.' }
  if (!fileName.toLowerCase().endsWith('.pdf') && fileType !== 'application/pdf')
    return { error: 'PDF만 업로드할 수 있습니다.' }
  if (fileSize > MAX_UPLOAD_BYTES) return { error: `파일이 너무 큽니다. 최대 ${MAX_UPLOAD_MB}MB까지 업로드할 수 있습니다.` }
  if (!r2Enabled()) return { direct: false }
  const { uploadUrl, storedName, url } = await presignR2Upload(fileName, fileType || 'application/pdf')
  return { direct: true, uploadUrl, storedName, url }
}

export async function registerSubjectDocument(
  sessionId: string,
  companyId: string,
  meta: { storedName: string; url: string; originalName: string; mimeType: string },
): Promise<{ ok: true } | { error: string }> {
  const { user } = await assertSessionAccess(sessionId)
  if (user.role === 'MASTER') return { error: '담당자만 업로드할 수 있습니다.' }
  if (!(await subjectsEditable(sessionId))) return { error: '제출/승인 상태에서는 자료를 수정할 수 없습니다.' }
  // presign에서 발급한 키 형식만 허용(임의 키 등록 방지)
  if (meta.url !== `r2:documents/${meta.storedName}` || !/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(meta.storedName))
    return { error: '잘못된 업로드 정보입니다.' }
  const size = await headR2Upload(meta.url)
  if (size === null) return { error: '업로드된 파일을 찾을 수 없습니다. 다시 시도해주세요.' }
  if (size > MAX_UPLOAD_BYTES) {
    await deleteUpload(meta.storedName, meta.url)
    return { error: `파일이 너무 큽니다. 최대 ${MAX_UPLOAD_MB}MB까지 업로드할 수 있습니다.` }
  }
  await prisma.document.create({
    data: {
      companyId,
      sessionId,
      originalName: meta.originalName,
      storedName: meta.storedName,
      url: meta.url,
      mimeType: meta.mimeType || 'application/pdf',
      size,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
  return { ok: true }
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

// 전역 풀의 기존 위원을 이 분과에 배정(폼: userId). 담당자 전용, 배정중(DRAFT/REJECTED)에만. 배정은 PENDING.
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


// 담당자(+마스터)가 제출완료 평가를 승인
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

// 담당자(+마스터)가 제출완료 평가를 반려(위원 편집 재개)
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

// ── 평가위원 배정 검토 워크플로: 담당자 제출 → 관리자 승인/반려 ──
// 담당자 제출 → 관리자 검토 대기(SUBMITTED). 관리자는 조회만이므로 MASTER는 차단. 배정이 없으면 제출 불가.
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

// 담당자 제출 취소 → 다시 배정중(DRAFT). 관리자 승인/반려 전(SUBMITTED)에만 가능.
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

// 관리자 배정 반려(SUBMITTED → REJECTED) + 사유. 담당자가 위원을 조정 후 재제출. 마스터 전용.
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

// 담당자(담당) 집계결과 '제출 완료' → 관리자 검토 대기. 관리자는 조회만이므로 MASTER는 차단.
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

// 담당자 제출 취소(관리자 검토 완료 전까지). 마감(CLOSED)된 분과는 되돌릴 수 없다.
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

// 관리자 검토 완료 → 분과 완료(CLOSED). 사전 조건: 담당자가 '제출 완료'했어야 함(submittedForReviewAt).
// eventDate 마감 가드(canCloseSession)는 의도적으로 건너뛴다(스펙상 검토 완료엔 사전 마감조건 없음).
export async function completeReview(sessionId: string) {
  await assertMaster()
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { submittedForReviewAt: true } })
  if (!s || s.submittedForReviewAt == null) return // 담당자 제출 전에는 검토 완료 불가
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

// ── 평가 대상 검토 워크플로: 담당자 제출 → 관리자 승인/반려 (세션 단위) ──
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

// ── 평가 의견서 검토 워크플로: 담당자 제출 → 관리자 승인/반려 (세션 단위) ──
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
