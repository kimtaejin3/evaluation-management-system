// 비밀번호 표시 셀 — 관리자 화면이므로 블라인드 없이 임시 비밀번호를 그대로 보여준다(고객 요청).
export default function PasswordCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-slate-400">미발급</span>
  return <span className="font-mono text-sm tabular-nums text-slate-700">{value}</span>
}
