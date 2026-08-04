'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { passwordFromPhone } from '@/lib/phone'
import { saveUpload, deleteUpload, isPdf } from '@/lib/storage'
import { requireAdminUser, assertMaster } from '@/lib/authz'

// ---- 평가위원·담당자 계정 관리(전역) ----

export async function createEvaluator(formData: FormData) {
  const actor = await requireAdminUser()
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  // 임시 비밀번호 = 연락처 끝 4자리(연락처 필수)
  const password = passwordFromPhone(phone)
  // 역할: 담당자(SECRETARY) 생성은 마스터만. 그 외/담당자 아닌 요청은 평가위원.
  let role: 'SECRETARY' | 'EVALUATOR' =
    String(formData.get('role') ?? 'EVALUATOR') === 'SECRETARY' ? 'SECRETARY' : 'EVALUATOR'
  if (role === 'SECRETARY' && actor.role !== 'MASTER') role = 'EVALUATOR'
  if (!username || !name || !phone || !password) return

  await prisma.user.upsert({
    where: { username },
    update: { name, phone, role },
    create: { username, name, phone, role, passwordHash: await hashPassword(password), tempPassword: password },
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
  await prisma.user.update({ where: { id: userId }, data: { name, phone, affiliation, position } })
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
