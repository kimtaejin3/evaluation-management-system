import ExcelJS from 'exceljs'

// 표시 폭(한글 등 전각은 2칸) — 열 너비 계산용
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return w
}

const GRAY = 'FFD9D9D9'
const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }
const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }

type Cell = string | number | null | undefined

// 공통 스타일 시트 — 평가항목 내보내기처럼 헤더 회색 배경·볼드·가운데, 데이터 가운데·테두리,
// 격자선 숨김, 내용 맞춘 열 너비, 마지막 열 오른쪽 빈 열 숨김. 양식(데이터 없음)에도 그대로 쓴다.
export async function buildStyledSheet(opts: {
  sheetName: string
  columns: string[] // 머리글(= 열 순서)
  rows?: Array<Record<string, Cell>> // 데이터(객체). 양식이면 생략
}): Promise<ArrayBuffer> {
  const { sheetName, columns } = opts
  const rows = opts.rows ?? []
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  const maxW = columns.map((c) => displayWidth(c))

  // 헤더
  const header = ws.addRow(columns)
  for (let c = 1; c <= columns.length; c++) {
    const cell = header.getCell(c)
    cell.font = { bold: true }
    cell.alignment = CENTER
    cell.border = BORDER
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
  }

  // 데이터
  for (const r of rows) {
    const vals = columns.map((c) => {
      const v = r[c]
      return v == null ? '' : v
    })
    const row = ws.addRow(vals)
    for (let c = 1; c <= columns.length; c++) {
      const cell = row.getCell(c)
      cell.alignment = CENTER
      cell.border = BORDER
      maxW[c - 1] = Math.max(maxW[c - 1], displayWidth(String(vals[c - 1] ?? '')))
    }
  }

  // 열 너비(내용 맞춤, 상한 60)
  columns.forEach((_, i) => {
    ws.getColumn(i + 1).width = Math.min(60, maxW[i] + 3)
  })
  // 격자선은 엑셀 기본대로 켜 둔다 — 표 밖 빈 열까지 평범한 스프레드시트로 보이게.

  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer
}

// 내려받기 응답(.xlsx) 공통 헬퍼
export function xlsxResponse(buf: ArrayBuffer, filename: string): Response {
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
