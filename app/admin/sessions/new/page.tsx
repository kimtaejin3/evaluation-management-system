import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdminUser } from '@/lib/authz'
import { fmtYmd } from '@/lib/dates'
import { createSession } from '../actions'

const labelCls = 'block text-sm font-medium text-slate-700'
const inputCls = 'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const user = await requireAdminUser()
  const { projectId } = await searchParams
  const isMaster = user.role === 'MASTER'
  // 취소/뒤로가기는 소속 사업으로(없으면 분과 목록)
  const backHref = projectId ? `/admin/projects/${projectId}` : '/admin/projects'
  const backLabel = '← 분과 설정'
  // 접근 가능한 사업: 마스터=전체, 담당자=배정된 사업
  const [projects, secretaries] = await Promise.all([
    prisma.project.findMany({
      where: isMaster ? {} : { secretaries: { some: { id: user.id } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    // 담당자 선택은 마스터만 가능(담당자가 만들면 본인이 자동 담당)
    isMaster
      ? prisma.user.findMany({ where: { role: 'SECRETARY' }, orderBy: { name: 'asc' }, select: { id: true, name: true, username: true } })
      : Promise.resolve([]),
  ])

  // 담당자는 사업을 고르지 않는다 — 진입한 사업(쿼리) 또는 참여중인 사업으로 고정.
  // 마스터는 드롭다운으로 선택(진입한 사업이 있으면 미리 선택).
  const fixedProject = !isMaster
    ? ((projectId ? projects.find((p) => p.id === projectId) : undefined) ?? projects[0])
    : undefined
  // 선택된 사업의 기간 — 평가 기간 입력 범위(min/max)로 사용
  const selected = fixedProject ?? (projectId ? projects.find((p) => p.id === projectId) : undefined)
  const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined)
  const min = toInput(selected?.startDate ?? null)
  const max = toInput(selected?.endDate ?? null)

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl">
        <Link href={backHref} className="text-sm text-slate-400 hover:text-slate-600">{backLabel}</Link>
        <h1 className="mt-1 text-2xl font-bold">새 분과 등록</h1>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          배정된 사업이 없어 분과를 만들 수 없습니다. {user.role === 'MASTER' ? '먼저 사업을 만들고 담당자를 배정하세요.' : '마스터에게 사업 배정을 요청하세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link href={backHref} className="text-sm text-slate-400 hover:text-slate-600">{backLabel}</Link>
      <h1 className="mt-1 text-2xl font-bold">새 분과 등록</h1>
      <p className="mt-1 text-sm text-slate-500">평가를 진행할 분과의 기본 정보를 입력합니다.</p>

      <form action={createSession} className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="space-y-4 p-5">
          <div>
            <label className={labelCls}>사업 <span className="text-rose-500">*</span></label>
            {fixedProject ? (
              <>
                {/* 담당자: 참여중인 사업으로 고정(선택 불가) */}
                <input type="hidden" name="projectId" value={fixedProject.id} />
                <p className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {fixedProject.name}
                </p>
              </>
            ) : (
              <select name="projectId" required defaultValue={projectId ?? ''} className={inputCls}>
                <option value="" disabled>사업 선택</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelCls}>분과명 <span className="text-rose-500">*</span></label>
            <input name="name" required className={inputCls} placeholder="예) 2026년 상반기 사업 평가" />
          </div>
          <div>
            <label className={labelCls}>설명</label>
            <textarea name="description" rows={2} className={`${inputCls} resize-none`} placeholder="분과에 대한 간단한 설명(선택)" />
          </div>
          <div>
            <label className={labelCls}>평가 기간 <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-2 gap-4">
              <input name="startDate" type="date" required min={min} max={max} className={inputCls} />
              <input name="endDate" type="date" required min={min} max={max} className={inputCls} />
            </div>
            {selected?.startDate && selected?.endDate && (
              <p className="mt-1 text-xs text-slate-400">
                사업 기간({fmtYmd(selected.startDate)} ~ {fmtYmd(selected.endDate)}) 안에서 입력하세요.
              </p>
            )}
          </div>
          {isMaster && (
            <div>
              <label className={labelCls}>담당자</label>
              <select name="secretaryId" defaultValue="" className={inputCls}>
                <option value="">미배정(선택)</option>
                {secretaries.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.username}</option>
                ))}
              </select>
              {secretaries.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">등록된 담당자가 없습니다. 나중에 배정할 수 있습니다.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Link href={backHref} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">취소</Link>
          <button className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">분과 생성</button>
        </div>
      </form>
    </div>
  )
}
