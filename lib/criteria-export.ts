import ExcelJS from 'exceljs'

// 평가항목 내보내기용 데이터 구조
export type ExportSubitem = {
  name: string
  maxScore: number | null // 통합 배점(세부항목 단위 배점). null이면 지표별 배점
  criteria: { name: string; maxScore: number }[]
}
export type ExportGroup = {
  name: string
  subitems: ExportSubitem[]
}

// 표시 폭(한글 등 전각은 2칸) — 열 너비 계산용
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return w
}

const HEADER = ['평가항목', '세부항목', '평가지표', '배점']
const GRAY = 'FFD9D9D9'
const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }
const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }

// 평가항목(그룹)→세부항목→평가지표를 화면 표처럼 병합·정렬한 xlsx 버퍼로 만든다.
// - 평가항목: 그룹의 모든 행 세로 병합
// - 세부항목: 세부항목의 지표 행들 세로 병합
// - 배점: 통합 배점(세부항목 단위)이면 지표 행들 세로 병합, 지표별이면 각 지표 행에 개별 배점
export async function buildCriteriaWorkbook(groups: ExportGroup[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('평가항목')

  // 헤더
  const header = ws.addRow(HEADER)
  header.eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = CENTER
    cell.border = BORDER
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
  })

  // 열 너비 계산용 최대 표시폭(헤더 폭에서 시작)
  const maxW = HEADER.map((h) => displayWidth(h))
  const bump = (col: number, text: string) => {
    maxW[col] = Math.max(maxW[col], displayWidth(text))
  }

  const merges: string[] = []
  const colLetter = ['A', 'B', 'C', 'D']

  for (const g of groups) {
    const groupStart = ws.rowCount + 1
    for (const sub of g.subitems) {
      const subStart = ws.rowCount + 1
      const isMerged = sub.maxScore != null // 통합 배점

      const criteria = sub.criteria.length > 0 ? sub.criteria : [{ name: '', maxScore: sub.maxScore ?? 0 }]
      // 지표 없고 배점도 없으면 건너뜀
      if (sub.criteria.length === 0 && sub.maxScore == null) continue

      criteria.forEach((c, i) => {
        const 배점 = isMerged ? (i === 0 ? sub.maxScore : '') : c.maxScore
        ws.addRow([i === 0 ? g.name : '', i === 0 ? sub.name : '', c.name, 배점])
        bump(2, c.name)
      })
      bump(0, g.name)
      bump(1, sub.name)

      const subEnd = ws.rowCount
      if (subEnd > subStart) {
        merges.push(`B${subStart}:B${subEnd}`) // 세부항목 병합
        if (isMerged) merges.push(`D${subStart}:D${subEnd}`) // 통합 배점 병합
      }
    }
    const groupEnd = ws.rowCount
    if (groupEnd >= groupStart) {
      if (groupEnd > groupStart) merges.push(`A${groupStart}:A${groupEnd}`) // 평가항목 병합
    }
  }

  merges.forEach((m) => ws.mergeCells(m))

  // 전체 셀 정렬·테두리(데이터 행)
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c)
      cell.alignment = CENTER
      cell.border = BORDER
    }
  }

  // 열 너비 — 셀 내용에 맞춤. 평가지표는 상한을 두어 한 페이지에 들어오게 하고, 긴 지표는 줄바꿈.
  const CAP = [24, 26, 58, 10]
  ws.columns.forEach((col, i) => {
    col.width = Math.min(CAP[i], maxW[i] + 2)
  })

  // 행 높이 — 내용에 맞춰 촘촘하게(빈 공간 최소화). 평가지표가 열 너비를 넘으면 줄 수만큼만.
  const cWidth = ws.getColumn(3).width ?? 60
  ws.getRow(1).height = 22
  for (let r = 2; r <= ws.rowCount; r++) {
    const text = String(ws.getRow(r).getCell(3).value ?? '')
    const lines = Math.max(1, Math.ceil(displayWidth(text) / (cWidth - 1)))
    ws.getRow(r).height = lines === 1 ? 19 : lines * 15
  }

  // 배점(마지막 열, 4번째) 오른쪽의 모든 빈 열(E~XFD)을 숨겨, 표가 배점에서 끝나 보이게 한다.
  // (엑셀·Numbers는 표 밖에도 빈 열을 계속 보여줘 'E열이 비어 존재'하는 것처럼 느껴지므로 전부 숨김)
  for (let c = 5; c <= 16384; c++) ws.getColumn(c).hidden = true

  // 시트 격자선 숨김 — 테두리 준 표(A~D)만 보이고 오른쪽/아래 빈 영역의 격자선(빈 컬럼처럼
  // 보이던 것)을 제거한다. 틀 고정(freeze)은 배점 오른쪽에 빈 칸처럼 보일 수 있어 사용하지 않는다.
  ws.views = [{ showGridLines: false }]
  // 인쇄/미리보기 시 한 페이지 폭에 맞춘다(평가지표가 넓어 여러 페이지로 쪼개지지 않도록).
  ws.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, horizontalCentered: true }

  void colLetter
  // exceljs writeBuffer는 Node에서 Buffer를 반환 — Response body로 넘기기 위해 ArrayBuffer로 취급.
  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer
}
