import ExcelJS from 'exceljs'

export type OpinionExportInput = {
  evaluators: { id: string; name: string; isChair: boolean }[]
  subjects: { id: string; name: string }[]
  groups: { id: string; name: string }[] // 평가항목(대분류) 순서
  opinionOf: Map<string, string> // `${evaluatorId}:${subjectId}` -> 종합의견
  groupCommentOf: Map<string, string> // `${evaluatorId}:${subjectId}:${groupId}` -> 항목별의견
}

function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return w
}
const colLetter = (n: number): string => {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const GRAY = 'FFD9D9D9'
const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

// 평가 의견서를 사진처럼 — 위원 / 지원기업 / 종합의견 + '항목별의견'(평가항목별 열)로 2단 머리글 병합.
export async function buildOpinionsWorkbook(input: OpinionExportInput): Promise<ArrayBuffer> {
  const { evaluators, subjects, groups, opinionOf, groupCommentOf } = input
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('평가의견서')

  const baseCols = ['위원', '지원기업', '종합의견']
  const totalCols = baseCols.length + groups.length
  const hasGroups = groups.length > 0

  // ── 머리글 ──
  if (hasGroups) {
    // 1행: 위원/지원기업/종합의견 + '항목별의견'(D~ 병합)
    ws.addRow([...baseCols, '항목별의견', ...Array(groups.length - 1).fill('')])
    // 2행: 앞 3칸 비우고 평가항목명
    ws.addRow(['', '', '', ...groups.map((g) => g.name)])
    ws.mergeCells('A1:A2')
    ws.mergeCells('B1:B2')
    ws.mergeCells('C1:C2')
    ws.mergeCells(`D1:${colLetter(totalCols)}1`)
  } else {
    ws.addRow(baseCols)
  }
  const headerRows = hasGroups ? 2 : 1

  // ── 데이터 ──
  const maxW = [displayWidth('위원'), displayWidth('지원기업'), displayWidth('종합의견'), ...groups.map((g) => displayWidth(g.name))]
  for (const ev of evaluators) {
    for (const s of subjects) {
      const 종합 = opinionOf.get(`${ev.id}:${s.id}`) ?? ''
      const groupTexts = groups.map((g) => groupCommentOf.get(`${ev.id}:${s.id}:${g.id}`) ?? '')
      // 종합의견 또는 항목별의견이 하나라도 있으면 행 추가
      if (!종합 && groupTexts.every((t) => !t)) continue
      const name = ev.name + (ev.isChair ? ' (위원장)' : '')
      ws.addRow([name, s.name, 종합, ...groupTexts])
      maxW[0] = Math.max(maxW[0], displayWidth(name))
      maxW[1] = Math.max(maxW[1], displayWidth(s.name))
    }
  }
  // 데이터가 없으면 빈 안내 행
  if (ws.rowCount === headerRows) ws.addRow(['', '', '', ...Array(groups.length).fill('')])

  // ── 스타일 ──
  const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }
  const LEFT = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }

  // 머리글(회색·볼드·가운데)
  for (let r = 1; r <= headerRows; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c)
      cell.font = { bold: true }
      cell.alignment = CENTER
      cell.border = BORDER
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
    }
    row.height = 20
  }
  // 데이터(위원·지원기업 가운데, 텍스트 왼쪽·중앙·줄바꿈)
  for (let r = headerRows + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c)
      cell.alignment = c <= 2 ? CENTER : LEFT
      cell.border = BORDER
    }
  }

  // 열 너비 — 내용 맞춤(종합의견·항목별의견은 넉넉히)
  const CAP = [14, 24, 50, ...groups.map(() => 30)]
  for (let c = 1; c <= totalCols; c++) {
    ws.getColumn(c).width = Math.min(CAP[c - 1], maxW[c - 1] + 2)
  }

  // 머리글 고정 + 격자선 숨김
  ws.views = [{ state: 'frozen', ySplit: headerRows, showGridLines: false }]

  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer
}
