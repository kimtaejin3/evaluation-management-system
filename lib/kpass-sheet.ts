// 서버 전용: 업로드된 엑셀(.xlsx/.xls/.csv) → string[][] 격자. (xlsx는 무거워 클라 번들에 넣지 않음)
import * as XLSX from 'xlsx'

export function parseSheet(buf: ArrayBuffer | Buffer): string[][] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  // header:1 → 행 배열, defval:'' → 빈 셀도 자리 유지(병합셀은 좌상단에만 값)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  return rows.map((r) => (r as unknown[]).map((c) => (c == null ? '' : String(c).trim())))
}
