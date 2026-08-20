'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { passwordFromPhone } from '@/lib/phone'
import { saveUpload, deleteUpload, isPdf } from '@/lib/storage'
import { requireAdminUser, assertMaster } from '@/lib/authz'
import { buildSecretaries, type SecretaryColumnMapping } from '@/lib/secretary-import'
import { buildEvalAccounts, type EvalAccountColumnMapping } from '@/lib/evaluator-account-import'

// ---- 평가위원·담당자 계정 관리(전역) ----

export async function createEvaluator(formData: FormData) {
  const actor = await requireAdminUser()
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const affiliation = String(formData.get('affiliation') ?? '').trim() || null
  const position = String(formData.get('position') ?? '').trim() || null
  // 임시 비밀번호 = 연락처 끝 4자리(연락처 필수)
  const password = passwordFromPhone(phone)
  // 역할: 담당자(SECRETARY) 생성은 마스터만. 그 외/담당자 아닌 요청은 평가위원.
  let role: 'SECRETARY' | 'EVALUATOR' =
    String(formData.get('role') ?? 'EVALUATOR') === 'SECRETARY' ? 'SECRETARY' : 'EVALUATOR'
  if (role === 'SECRETARY' && actor.role !== 'MASTER') role = 'EVALUATOR'
  if (!username || !name || !phone || !password) return

  await prisma.user.upsert({
    where: { username },
    update: { name, phone, role, affiliation, position },
    create: { username, name, phone, role, affiliation, position, passwordHash: await hashPassword(password), tempPassword: password },
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  // 전용 등록 페이지에서 생성하므로 목록으로 복귀
  redirect('/admin/evaluators')
}

export async function deleteEvaluator(userId: string) {
  await requireAdminUser()
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
}

// 담당자(계정) 일괄 삭제 — 담당자 관리에서 체크박스로 여러 명 선택 후 한 번에 삭제(마스터 전용)
export async function deleteSecretaries(ids: string[]) {
  await assertMaster()
  const clean = ids.filter(Boolean)
  if (clean.length === 0) return
  // role 가드 — 담당자만 삭제 대상
  await prisma.user.deleteMany({ where: { id: { in: clean }, role: 'SECRETARY' } })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/secretaries')
}

// 평가위원(계정) 일괄 삭제 — 평가위원 관리에서 선택 후 한 번에 삭제(마스터 전용)
export async function deleteEvaluators(ids: string[]) {
  await assertMaster()
  const clean = ids.filter(Boolean)
  if (clean.length === 0) return
  // role 가드 — 평가위원만 삭제 대상
  await prisma.user.deleteMany({ where: { id: { in: clean }, role: 'EVALUATOR' } })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
}

// '정보 변경' 모달에서 한 위원의 분과 배정을 한 번에 설정(체크된 분과 = 배정).
// 후보(미마감·사업 있는) 분과 안에서만 추가/해제하며, 마감·고아 분과 배정은 건드리지 않는다.
export async function setEvaluatorSessions(
  userId: string,
  sessionIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const admin = await assertMaster()
  const user = await prisma.user.findFirst({ where: { id: userId, role: 'EVALUATOR' }, select: { id: true } })
  if (!user) return { ok: false, error: '평가위원을 찾을 수 없습니다.' }
  const want = new Set(sessionIds.filter(Boolean))
  // 현재 배정 + 각 분과의 배정 가능 여부(마감/고아 제외 판단용)
  const current = await prisma.assignment.findMany({
    where: { userId },
    select: { sessionId: true, session: { select: { status: true, projectId: true, chairId: true } } },
  })
  const assignable = (s: { status: string; projectId: string | null } | null) =>
    !!s && s.status !== 'CLOSED' && s.projectId != null
  const toRemove = current.filter((c) => assignable(c.session) && !want.has(c.sessionId))
  const currentIds = new Set(current.map((c) => c.sessionId))
  const toAdd = [...want].filter((sid) => !currentIds.has(sid))
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const sid of toAdd) {
      const s = await tx.evaluationSession.findUnique({ where: { id: sid }, select: { status: true, projectId: true } })
      if (!assignable(s)) continue // 마감/고아 분과는 배정 불가
      await tx.assignment.upsert({
        where: { sessionId_userId: { sessionId: sid, userId } },
        update: { status: 'APPROVED', decidedAt: now, createdById: admin.id },
        create: { sessionId: sid, userId, status: 'APPROVED', decidedAt: now, createdById: admin.id },
      })
      // 분과 배정 시 그 사업에도 참여 연결(참여 사업과 일관성 유지)
      if (s!.projectId) {
        await tx.user.update({ where: { id: userId }, data: { evaluatingProjects: { connect: { id: s!.projectId } } } })
      }
    }
    for (const c of toRemove) {
      await tx.assignment.delete({ where: { sessionId_userId: { sessionId: c.sessionId, userId } } })
      if (c.session?.chairId === userId) {
        await tx.evaluationSession.update({ where: { id: c.sessionId }, data: { chairId: null } })
      }
    }
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  return { ok: true }
}

// 평가위원의 '참여 사업'을 한 번에 설정(체크된 사업 = 참여). 분과는 '분과 설정'에서 이 사업 안에서 고른다.
// 참여 해제된 사업의 분과 배정(이 위원)은 함께 해제한다.
export async function setEvaluatorProjects(
  userId: string,
  projectIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await assertMaster()
  const user = await prisma.user.findFirst({
    where: { id: userId, role: 'EVALUATOR' },
    select: { id: true, evaluatingProjects: { select: { id: true } } },
  })
  if (!user) return { ok: false, error: '평가위원을 찾을 수 없습니다.' }
  const want = [...new Set(projectIds.filter(Boolean))]
  const beforeIds = user.evaluatingProjects.map((p) => p.id)
  const removed = beforeIds.filter((id) => !want.includes(id))
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { evaluatingProjects: { set: want.map((id) => ({ id })) } },
    })
    // 참여 해제된 사업의 분과에서 이 위원의 배정 제거(+ 위원장이면 해제)
    if (removed.length) {
      const affected = await tx.assignment.findMany({
        where: { userId, session: { projectId: { in: removed } } },
        select: { sessionId: true, session: { select: { chairId: true } } },
      })
      await tx.assignment.deleteMany({ where: { userId, session: { projectId: { in: removed } } } })
      for (const a of affected) {
        if (a.session?.chairId === userId) {
          await tx.evaluationSession.update({ where: { id: a.sessionId }, data: { chairId: null } })
        }
      }
    }
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  return { ok: true }
}

// 담당자의 '참여 사업'을 한 번에 설정(체크된 사업 = 참여). 분과는 '분과 설정'에서 이 사업 안에서 고른다.
// 참여 해제된 사업의 분과 중 이 담당자가 맡던 것은 함께 해제한다.
export async function setSecretaryProjects(
  userId: string,
  projectIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await assertMaster()
  const user = await prisma.user.findFirst({
    where: { id: userId, role: 'SECRETARY' },
    select: { id: true, assignedProjects: { select: { id: true } } },
  })
  if (!user) return { ok: false, error: '담당자를 찾을 수 없습니다.' }
  const want = [...new Set(projectIds.filter(Boolean))]
  const beforeIds = user.assignedProjects.map((p) => p.id)
  const removed = beforeIds.filter((id) => !want.includes(id))
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { assignedProjects: { set: want.map((id) => ({ id })) } },
    })
    // 참여 해제된 사업의 분과에서 이 담당자를 해제
    if (removed.length) {
      await tx.evaluationSession.updateMany({
        where: { projectId: { in: removed }, secretaryId: userId },
        data: { secretaryId: null },
      })
    }
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/secretaries')
  return { ok: true }
}

// '정보 변경' 모달에서 한 담당자가 담당할 분과를 한 번에 설정(체크된 분과 = 담당).
// 분과당 담당자는 1명이라 체크 시 secretaryId를 이 담당자로 지정(기존 교체)하고 사업 접근도 부여.
// 후보(미마감·사업 있는) 분과 안에서만 조정하며, 마감·고아 분과는 건드리지 않는다.
export async function setSecretarySessions(
  userId: string,
  sessionIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await assertMaster()
  const user = await prisma.user.findFirst({ where: { id: userId, role: 'SECRETARY' }, select: { id: true } })
  if (!user) return { ok: false, error: '담당자를 찾을 수 없습니다.' }
  const want = new Set(sessionIds.filter(Boolean))
  // 이 담당자가 현재 맡은(배정 가능한) 분과
  const current = await prisma.evaluationSession.findMany({
    where: { secretaryId: userId, status: { not: 'CLOSED' }, projectId: { not: null } },
    select: { id: true },
  })
  const currentIds = new Set(current.map((s) => s.id))
  const toRemove = [...currentIds].filter((sid) => !want.has(sid))
  const toAdd = [...want].filter((sid) => !currentIds.has(sid))
  await prisma.$transaction(async (tx) => {
    for (const sid of toAdd) {
      const s = await tx.evaluationSession.findUnique({ where: { id: sid }, select: { status: true, projectId: true } })
      if (!s || s.status === 'CLOSED' || !s.projectId) continue
      await tx.project.update({ where: { id: s.projectId }, data: { secretaries: { connect: { id: userId } } } })
      await tx.evaluationSession.update({ where: { id: sid }, data: { secretaryId: userId } })
    }
    for (const sid of toRemove) {
      await tx.evaluationSession.update({ where: { id: sid }, data: { secretaryId: null } })
    }
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/secretaries')
  return { ok: true }
}

// 임시 비밀번호 재발급 — 새 임시 비번 생성·저장
export async function resetEvaluatorPassword(userId: string) {
  await requireAdminUser()
  const newPw = randomUUID().replace(/-/g, '').slice(0, 8)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPw), tempPassword: newPw },
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
}

// 계정 정보 수정(담당자·평가위원 공통) — 이름/연락처/소속/직급. '정보 변경' 모달에서 호출.
// 삭제 후 재등록하지 않고 바로 고칠 수 있게 한다. 역할은 바꾸지 않는다.
export async function updateUserInfo(userId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdminUser()
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim() || null
  const affiliation = String(formData.get('affiliation') ?? '').trim() || null
  const position = String(formData.get('position') ?? '').trim() || null
  if (!name) return { ok: false, error: '이름은 필수입니다.' }
  const data: {
    name: string
    phone: string | null
    affiliation: string | null
    position: string | null
    username?: string
    passwordHash?: string
    tempPassword?: string
  } = { name, phone, affiliation, position }
  // 아이디 변경(폼에 있을 때만) — 중복 검사
  const username = formData.get('username')
  if (username !== null) {
    const uname = String(username).trim()
    if (!uname) return { ok: false, error: '아이디는 필수입니다.' }
    const dup = await prisma.user.findFirst({ where: { username: uname, id: { not: userId } }, select: { id: true } })
    if (dup) return { ok: false, error: '이미 사용 중인 아이디입니다.' }
    data.username = uname
  }
  // 비밀번호 직접 지정(폼에 있고 비어있지 않을 때만) — 해시 저장 + 표시용 임시 비번 갱신
  const password = String(formData.get('password') ?? '').trim()
  if (password) {
    if (password.length < 4) return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' }
    data.passwordHash = await hashPassword(password)
    data.tempPassword = password
  }
  await prisma.user.update({ where: { id: userId }, data })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  revalidatePath('/admin/secretaries')
  return { ok: true }
}

// 임시 비밀번호 재발급(담당자·평가위원 공통) — 새 임시 비번을 만들어 반환(모달에서 즉시 표시).
export async function resetUserPassword(userId: string): Promise<{ ok: boolean; password?: string }> {
  await requireAdminUser()
  const newPw = randomUUID().replace(/-/g, '').slice(0, 8)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPw), tempPassword: newPw },
  })
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  revalidatePath('/admin/secretaries')
  return { ok: true, password: newPw }
}

// ---- 담당자 엑셀 일괄 등록(마스터) ----

export type SecretaryImportPayload = { grid: string[][]; mapping: SecretaryColumnMapping; hasHeader: boolean }
export type ImportedSecretary = { name: string; username: string; tempPassword: string | null }
export type SecretaryImportResult = { ok: boolean; error?: string; warnings?: string[]; accounts?: ImportedSecretary[] }

// 담당자 명단(엑셀/붙여넣기)을 일괄 등록. 아이디 없으면 자동 생성, 비밀번호는 비었으면 연락처 끝
// 4자리(그것도 없으면 자동). 기존 아이디는 정보 갱신·담당자로 승격(비밀번호는 유지).
export async function commitSecretaryImport(payload: SecretaryImportPayload): Promise<SecretaryImportResult> {
  await assertMaster()
  const grid = payload.grid ?? []
  if (grid.length === 0) return { ok: false, error: '가져올 내용이 없습니다.' }
  const { rows, warnings } = buildSecretaries(grid, payload.mapping, { hasHeader: payload.hasHeader })
  if (rows.length === 0) return { ok: false, error: warnings[0] ?? '가져올 담당자가 없습니다.', warnings }

  const genUsername = () => `sec_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const genPassword = () => randomUUID().replace(/-/g, '').slice(0, 8)

  // bcrypt 해시는 느려 미리 준비(조회·해시)한 뒤 순차 쓰기.
  const prepared = await Promise.all(
    rows.map(async (r) => {
      const username = r.username || genUsername()
      const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } })
      if (existing) {
        return { kind: 'existing' as const, id: existing.id, username, name: r.name, phone: r.phone }
      }
      const pw = r.password || (r.phone ? passwordFromPhone(r.phone) : null) || genPassword()
      return { kind: 'new' as const, username, name: r.name, phone: r.phone, pw, hash: await hashPassword(pw) }
    }),
  )

  const accounts: ImportedSecretary[] = []
  for (const p of prepared) {
    if (p.kind === 'existing') {
      await prisma.user.update({ where: { id: p.id }, data: { name: p.name, phone: p.phone ?? undefined, role: 'SECRETARY' } })
      accounts.push({ name: p.name, username: p.username, tempPassword: null })
    } else {
      await prisma.user.create({
        data: { username: p.username, name: p.name, phone: p.phone, role: 'SECRETARY', passwordHash: p.hash, tempPassword: p.pw },
      })
      accounts.push({ name: p.name, username: p.username, tempPassword: p.pw })
    }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/secretaries')
  return { ok: true, warnings, accounts }
}

// ---- 평가위원 엑셀 일괄 등록(마스터) ----

export type EvalAccountImportPayload = { grid: string[][]; mapping: EvalAccountColumnMapping; hasHeader: boolean }
export type ImportedEvalAccount = { name: string; username: string; tempPassword: string | null }
export type EvalAccountImportResult = { ok: boolean; error?: string; warnings?: string[]; accounts?: ImportedEvalAccount[] }

// 평가위원 명단(엑셀/붙여넣기)을 전역 계정으로 일괄 등록. 아이디 없으면 자동 생성, 비밀번호는 비우면
// 연락처 끝 4자리(그것도 없으면 자동). 소속·직급 포함. 기존 아이디는 정보 갱신·평가위원으로 승격.
export async function commitEvalAccountImport(payload: EvalAccountImportPayload): Promise<EvalAccountImportResult> {
  await assertMaster()
  const grid = payload.grid ?? []
  if (grid.length === 0) return { ok: false, error: '가져올 내용이 없습니다.' }
  const { rows, warnings } = buildEvalAccounts(grid, payload.mapping, { hasHeader: payload.hasHeader })
  if (rows.length === 0) return { ok: false, error: warnings[0] ?? '가져올 평가위원이 없습니다.', warnings }

  const genUsername = () => `wiwon_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const genPassword = () => randomUUID().replace(/-/g, '').slice(0, 8)

  const prepared = await Promise.all(
    rows.map(async (r) => {
      const username = r.username || genUsername()
      const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } })
      const common = { name: r.name, phone: r.phone, affiliation: r.affiliation, position: r.position }
      if (existing) return { kind: 'existing' as const, id: existing.id, username, ...common }
      // 비밀번호는 연락처 뒷자리로 자동 발급(연락처 없으면 임의 생성)
      const pw = (r.phone ? passwordFromPhone(r.phone) : null) || genPassword()
      return { kind: 'new' as const, username, ...common, pw, hash: await hashPassword(pw) }
    }),
  )

  const accounts: ImportedEvalAccount[] = []
  for (const p of prepared) {
    if (p.kind === 'existing') {
      await prisma.user.update({
        where: { id: p.id },
        data: { name: p.name, phone: p.phone ?? undefined, affiliation: p.affiliation, position: p.position, role: 'EVALUATOR' },
      })
      accounts.push({ name: p.name, username: p.username, tempPassword: null })
    } else {
      await prisma.user.create({
        data: {
          username: p.username,
          name: p.name,
          phone: p.phone,
          affiliation: p.affiliation,
          position: p.position,
          role: 'EVALUATOR',
          passwordHash: p.hash,
          tempPassword: p.pw,
        },
      })
      accounts.push({ name: p.name, username: p.username, tempPassword: p.pw })
    }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/evaluators')
  return { ok: true, warnings, accounts }
}

// ---- 기업(평가 대상 원본) 관리(전역) ----

export async function createCompany(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const businessNo = String(formData.get('businessNo') ?? '').trim() || null
  const region = String(formData.get('region') ?? '').trim() || null
  const leadResearcher = String(formData.get('leadResearcher') ?? '').trim() || null
  // 기업명·지역·연구책임자 필수(인쇄 헤더용)
  if (!name || !region || !leadResearcher) return
  await prisma.company.upsert({
    where: { name },
    update: {
      description: String(formData.get('description') ?? '') || undefined,
      businessNo: businessNo ?? undefined,
      region: region ?? undefined,
      leadResearcher: leadResearcher ?? undefined,
    },
    create: { name, businessNo, region, leadResearcher, description: String(formData.get('description') ?? '') || null },
  })
  revalidatePath('/admin/companies')
}

export async function deleteCompany(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } })
  revalidatePath('/admin/companies')
}

// sessionId: 특정 심사용 자료면 심사 id, 비우면(공통) null
export async function uploadCompanyDocument(companyId: string, formData: FormData) {
  // PDF만 허용
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0 && isPdf(f))
  if (files.length === 0) return
  const sessionId = String(formData.get('sessionId') ?? '').trim() || null

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
  revalidatePath('/admin/companies')
}

export async function deleteCompanyDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  await deleteUpload(doc.storedName, doc.url)
  revalidatePath('/admin/companies')
}
