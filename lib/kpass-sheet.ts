// 서버 전용: 업로드된 엑셀(.xlsx/.xls/.csv) → string[][] 격자. (xlsx는 무거워 클라 번들에 넣지 않음)
import * as XLSX from 'xlsx'

export function parseSheet(buf: ArrayBuffer | Buffer): string[][] {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  // 형식 판별(매직 바이트): .xlsx/ODS=ZIP('PK' 50 4B), .xls=CFB(D0 CF 11 E0)는 바이너리로 읽고,
  // 그 외(CSV/TSV 등 텍스트)는 UTF-8로 디코드해 읽는다. 버퍼로 넘기면 CSV 한글이 codepage
  // 오해로 깨지므로(예: "평가항목"→"íê°í­ëª©"), 텍스트는 반드시 UTF-8 문자열로 넘긴다.
  const isBinary = (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf)
  const wb = isBinary
    ? XLSX.read(b, { type: 'buffer' })
    : XLSX.read(b.toString('utf-8').replace(/^\uFEFF/, ''), { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  // header:1 → 행 배열, defval:'' → 빈 셀도 자리 유지(병합셀은 좌상단에만 값)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  return rows.map((r) => (r as unknown[]).map((c) => (c == null ? '' : String(c).trim())))
}
