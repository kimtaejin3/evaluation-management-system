'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { saveUpload, deleteUpload, isPdf } from '@/lib/storage'
import { canCloseSession, CLOSE_BLOCKED_MESSAGE } from '@/lib/session-rules'

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

// 심사 삭제 — criteria/subjects/assignments/scores는 Cascade.
// 이 심사 전용 자료(sessionId 지정)는 파일까지 함께 삭제, 공통 자료(sessionId=null)는 보존.
// Opinion·EditingPresence는 관계가 없어 별도 정리.
export async function deleteSession(sessionId: string) {
  const docs = await prisma.document.findMany({ where: { sessionId } })
  for (const d of docs) {
    await deleteUpload(d.storedName, d.url)
  }
  await prisma.document.deleteMany({ where: { sessionId } })
  await prisma.opinion.deleteMany({ where: { sessionId } })
  await prisma.editingPresence.deleteMany({ where: { sessionId } })
  await prisma.evaluationSession.delete({ where: { id: sessionId } })
  revalidatePath('/admin/sessions')
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

export async function updateCriterion(sessionId: string, criterionId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const type = String(formData.get('type')) === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE'
  const description = String(formData.get('description') ?? '') || null
  const section = String(formData.get('section') ?? '').trim() || null

  let maxScore: number
  let gradeOptions: { label: string; points: number }[] | null = null

  if (type === 'QUALITATIVE') {
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

  await prisma.criterion.update({
    where: { id: criterionId },
    data: {
      section,
      name,
      description,
      type,
      maxScore,
      // 정성이면 등급 옵션 저장, 정량으로 바꾸면 등급 옵션 제거
      gradeOptions: gradeOptions ?? Prisma.DbNull,
    },
  })
  revalidatePath(`/admin/sessions/${sessionId}/criteria`)
}

export async function deleteCriterion(sessionId: string, criterionId: string) {
  await prisma.criterion.delete({ where: { id: criterionId } })
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
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return
  await prisma.document.delete({ where: { id: documentId } })
  await deleteUpload(doc.storedName, doc.url)
  revalidatePath(`/admin/sessions/${sessionId}/subjects`)
}

export async function removeEvaluator(sessionId: string, userId: string) {
  await prisma.assignment.delete({ where: { sessionId_userId: { sessionId, userId } } })
  // 배정 해제된 위원이 위원장이었다면 위원장 해제
  const s = await prisma.evaluationSession.findUnique({ where: { id: sessionId }, select: { chairId: true } })
  if (s?.chairId === userId) {
    await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: null } })
  }
  revalidatePath(`/admin/sessions/${sessionId}/evaluators`)
}

// 평가위원장 지정/해제 — 배정된 위원 중 1인. userId 비우면 해제.
export async function setChair(sessionId: string, formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim()
  if (userId) {
    // 배정된 위원만 위원장이 될 수 있음
    const assigned = await prisma.assignment.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
    if (!assigned) return
  }
  await prisma.evaluationSession.update({ where: { id: sessionId }, data: { chairId: userId || null } })
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
