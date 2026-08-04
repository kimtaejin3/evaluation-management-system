// 서버 전용: 업로드된 엑셀(.xlsx/.xls/.csv) → string[][] 격자. (xlsx는 무거워 클라 번들에 넣지 않음)
import * as XLSX from 'xlsx'

// CSV/TSV 텍스트 버퍼를 인코딩 자동 감지해 문자열로 디코드한다.
// UTF-8(BOM 유무 무관)을 우선 시도하고, 유효한 UTF-8이 아니면 EUC-KR(CP949)로 간주한다.
// (구형 윈도우 엑셀은 한글 CSV를 EUC-KR로 저장 — 한글 바이트는 유효 UTF-8이 아니라 깔끔히 구분됨)
function decodeText(b: Buffer): string {
  try {
    // fatal:true → 잘못된 UTF-8 시퀀스면 예외. 선행 BOM은 TextDecoder가 자동 제거.
    return new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    return new TextDecoder('euc-kr').decode(b)
  }
}

export function parseSheet(buf: ArrayBuffer | Buffer): string[][] {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  // 형식 판별(매직 바이트): .xlsx/ODS=ZIP('PK' 50 4B), .xls=CFB(D0 CF 11 E0)는 바이너리로 읽고,
  // 그 외(CSV/TSV 등 텍스트)는 인코딩 감지 후 문자열로 읽는다. 버퍼로 넘기면 CSV 한글이 codepage
  // 오해로 깨지므로(예: "평가항목"→"íê°í­ëª©"), 텍스트는 반드시 디코드한 문자열로 넘긴다.
  const isBinary = (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf)
  const wb = isBinary
    ? XLSX.read(b, { type: 'buffer' })
    : XLSX.read(decodeText(b), { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  // header:1 → 행 배열, defval:'' → 빈 셀도 자리 유지(병합셀은 좌상단에만 값)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  return rows.map((r) => (r as unknown[]).map((c) => (c == null ? '' : String(c).trim())))
}
