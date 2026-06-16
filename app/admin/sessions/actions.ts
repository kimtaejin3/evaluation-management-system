'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { saveUpload, deleteUpload } from '@/lib/storage'
import { canCloseSession, CLOSE_BLOCKED_MESSAGE } from '@/lib/session-rules'
import { getCriteriaTemplate } from '@/lib/criteria-templates'

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
  if (status === 'CLOSED') {
    const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { eventDate: true } })
    if (s && !canCloseSession(s.eventDate)) {
      throw new Error(CLOSE_BLOCKED_MESSAGE)
    }
  }
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { status } })
  revalidatePath(`/admin/sessions/${sessionId}`)
}

export async function addCriterion(sessionId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const type = String(formData.get('type')) === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE'
  const weight = Number(formData.get('weight') ?? 1)
  const description = String(formData.get('description') ?? '') || null
  const section = String(formData.get('section') ?? '').trim() || null

  let maxScore: number
  let gradeOptions: { label: string; points: number }[] | undefined

  if (type === 'QUALITATIVE') {
    // 등급(답) 옵션: optLabel[] + optPoints[]
    const labels = formData.getAll('optLabel').map((v) => String(v).trim())
    const points = formData.getAll('optPoints').map((v) => Number(v))
    const opts = labels
      .map((label, i) => ({ label, points: points[i] }))
      .filter((o) => o.label && Number.isFinite(o.points))
    if (opts.length === 0) return
    gradeOptions = opts
    maxScore = Math.max(...opts.map((o) => o.points))
  } else {
    maxScore = Number(formData.get('maxScore') ?? 0)
  }

  const count = await prisma.criterion.count({ where: { sessionId } })
  await prisma.criterion.create({
    data: { sessionId, section, name, description, type, maxScore, weight, order: count, gradeOptions },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function deleteCriterion(sessionId: string, criterionId: string) {
  await prisma.criterion.delete({ where: { id: criterionId } })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

// 평가표 템플릿 일괄 적용 — 항목(대제목)·세부항목·등급을 한 번에 구성.
// 점수 입력이 시작된 심사는 안전을 위해 덮어쓰지 않음. 그 외에는 기존 항목을 대체.
export async function applyCriteriaTemplate(sessionId: string, key: string): Promise<{ error?: string } | void> {
  const tpl = getCriteriaTemplate(key)
  if (!tpl) return { error: '알 수 없는 템플릿입니다.' }

  const scoreCount = await prisma.score.count({ where: { sessionId } })
  if (scoreCount > 0) return { error: '이미 점수가 입력된 심사에는 템플릿을 적용할 수 없습니다.' }

  await prisma.criterion.deleteMany({ where: { sessionId } })

  let order = 0
  for (const sec of tpl.sections) {
    for (const it of sec.items) {
      const maxScore = Math.max(...it.grades.map((g) => g.points))
      await prisma.criterion.create({
        data: {
          sessionId,
          section: sec.section,
          name: it.name,
          description: it.description ?? null,
          type: 'QUALITATIVE',
          maxScore,
          weight: 1,
          order: order++,
          gradeOptions: it.grades,
        },
      })
    }
  }
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

// 심사에 평가 대상(기업) 편입 — 기존 기업 선택(companyId) 또는 신규 기업명(newName)
export async function addSubject(sessionId: string, formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim()
  const newName = String(formData.get('newName') ?? '').trim()

  let company: { id: string; name: string; description: string | null } | null = null
  if (companyId) {
    company = await prisma.company.findUnique({ where: { id: companyId } })
  } else if (newName) {
    company = await prisma.company.upsert({
      where: { name: newName },
      update: {},
      create: { name: newName },
    })
  }
  if (!company) return

  // 같은 심사에 이미 편입된 기업이면 무시(유니크 제약)
  const exists = await prisma.subject.findUnique({
    where: { sessionId_companyId: { sessionId, companyId: company.id } },
  })
  if (exists) {
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
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function deleteSubject(sessionId: string, subjectId: string) {
  await prisma.subject.delete({ where: { id: subjectId } })
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

// 평가 대상(기업) 자료 업로드 — 이 심사 전용(sessionId)으로 저장. 사업계획/현장실태조사서/사전검토표 등
export async function uploadSubjectDocument(sessionId: string, companyId: string, formData: FormData) {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
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
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  await deleteUpload(doc.storedName, doc.url)
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function addEvaluator(sessionId: string, formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !name || !password) return

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, name, role: 'EVALUATOR', passwordHash: await hashPassword(password), tempPassword: password },
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

// 평가위원 관리에서 등록한 기존 위원을 이 심사에 배정(폼: userId)
export async function assignEvaluator(sessionId: string, formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return
  await prisma.assignment.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: {},
    create: { sessionId, userId },
  })
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// ---- 심사 복사 ----

export async function duplicateSession(sessionId: string) {
  const src = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    include: { criteria: true, subjects: true },
  })
  if (!src) return

  const copy = await prisma.evaluationSession.create({
    data: {
      name: `${src.name} (복사본)`,
      description: src.description,
      location: src.location,
      eventDate: src.eventDate,
      status: 'DRAFT',
      criteria: {
        create: src.criteria.map((c) => ({
          section: c.section,
          name: c.name,
          description: c.description,
          type: c.type,
          maxScore: c.maxScore,
          weight: c.weight,
          order: c.order,
          gradeOptions: c.gradeOptions ?? undefined,
        })),
      },
      subjects: {
        create: src.subjects.map((s) => ({
          companyId: s.companyId,
          name: s.name,
          description: s.description,
          order: s.order,
        })),
      },
    },
  })
  redirect(`/admin/sessions/${copy.id}`)
}
