// 진행 단계 스텝퍼 — 단계별 상태(완료/현재/대기/반려)를 받아 가로로 표시.
// done: 네이비 체크 · current: 네이비+링 강조 · todo: 회색 · rejected: 붉은 '!'
export type StepState = 'done' | 'current' | 'todo' | 'rejected'

// 완료 플래그 배열 → 스텝 상태: 완료는 done, 첫 미완료는 current, 나머지는 todo.
export function stepsFromFlags(labels: readonly string[], flags: boolean[]): { label: string; state: StepState }[] {
  const currentIdx = flags.findIndex((f) => !f)
  return labels.map((label, i) => ({
    label,
    state: flags[i] ? 'done' : i === currentIdx ? 'current' : 'todo',
  }))
}

export default function ReviewStepper({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const done = s.state === 'done'
        const isCurrent = s.state === 'current'
        const reject = s.state === 'rejected'

        // 완료 단계만 색(네이비+체크). 미완료(현재·대기)는 색·체크 없이 회색.
        // 현재 단계는 채움 대신 회색 링과 굵은 글씨로만 구분한다.
        const circle = reject
          ? 'bg-rose-500 text-white ring-2 ring-rose-200'
          : done
            ? 'bg-[var(--gov-navy)] text-white'
            : isCurrent
              ? 'bg-slate-100 text-slate-500 ring-2 ring-slate-300'
              : 'bg-slate-100 text-slate-400'
        const text = reject
          ? 'text-rose-600 font-semibold'
          : done
            ? 'text-slate-600'
            : isCurrent
              ? 'text-slate-700 font-semibold'
              : 'text-slate-400'

        return (
          <li key={i} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circle}`}>
                {reject ? '!' : done ? '✓' : i + 1}
              </span>
              <span className={`whitespace-nowrap text-xs sm:text-sm ${text}`}>
                {s.label}
                {last && <span className="ml-1 text-[11px] font-normal text-slate-400">(최종 완료)</span>}
              </span>
            </div>
            {!last && <span className={`mx-2 h-px w-5 sm:w-8 ${done ? 'bg-[var(--gov-navy)]' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}
