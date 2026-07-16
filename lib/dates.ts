// 날짜 표기 — 'YYYY.MM.DD' (예: 2026.06.01). 기간(평가 기간·과제 기간) 표시 공용.
export function fmtYmd(d: Date | string | null | undefined): string {
  if (!d) return '미정'
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`
}

// 상대 시간 표기 — '방금 전', 'n분 전', 'n시간 전', 'n일 전' (모니터링 조회 시간 등)
export function fmtRelative(d: Date | string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(d).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
