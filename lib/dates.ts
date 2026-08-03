// 날짜 표기 — 'YYYY.MM.DD' (예: 2026.06.01). 기간(평가 기간·사업 기간) 표시 공용.
export function fmtYmd(d: Date | string | null | undefined): string {
  if (!d) return '미정'
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`
}

// 일시 표기 — 'YYYY.MM.DD HH:mm', 한국 시간(Asia/Seoul) 고정.
// 서버가 UTC(예: Vercel)여도 KST로 일관 표시되도록 timeZone을 명시한다.
export function fmtDateTimeKst(d: Date | string): string {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(d))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}
