// 날짜 표기 — 'YYYY.MM.DD' (예: 2026.06.01). 기간(평가 기간·과제 기간) 표시 공용.
export function fmtYmd(d: Date | string | null | undefined): string {
  if (!d) return '미정'
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`
}
