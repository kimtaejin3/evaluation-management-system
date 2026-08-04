import { describe, it, expect } from 'vitest'
import { parseHtmlTable } from './clipboard-table'
import { autoDetectMapping, resolveHeader, buildCriteria } from '@/lib/kpass-import'

// 붙여넣기(한글/엑셀/워드) → parseHtmlTable → 자동 매핑 → buildCriteria 왕복을 검증한다.
// 한글(HWP)에서 평가표를 복사하면 클립보드 text/html 에 아래와 유사한 <table>이 담긴다.
// (병합셀 rowspan, 셀 안 <p>, &nbsp;, 스타일 속성 등)

// 실제 한글 평가표를 복사했을 때와 유사한 HTML — '평가항목'이 세로 병합(rowspan)된 형태
const HWP_HTML = `
<html><head><meta charset="utf-8"><style>td{border:1px solid}</style></head><body>
<table border="1" style="border-collapse:collapse">
  <tr>
    <td><p>평가항목</p></td>
    <td><p>세부항목</p></td>
    <td><p>평가지표</p></td>
    <td><p>배점</p></td>
  </tr>
  <tr>
    <td rowspan="2"><p>사업계획</p></td>
    <td><p>목표&nbsp;및&nbsp;내용</p></td>
    <td><p>RFP 부합 정도</p></td>
    <td><p>25</p></td>
  </tr>
  <tr>
    <td><p>추진 체계</p></td>
    <td><p>컨소시엄 구성의 적절성</p></td>
    <td><p>15</p></td>
  </tr>
  <tr>
    <td><p>추진역량</p></td>
    <td><p>연구진 역량</p></td>
    <td><p>연구책임자 전문성</p></td>
    <td><p>30</p></td>
  </tr>
  <tr>
    <td rowspan="2"><p>기대효과</p></td>
    <td><p>사업화 가능성</p></td>
    <td><p>사업화 전략의 우수성</p></td>
    <td><p>20</p></td>
  </tr>
  <tr>
    <td><p>파급효과</p></td>
    <td><p>고용 창출<br>경제적 파급</p></td>
    <td><p>10</p></td>
  </tr>
</table>
</body></html>`

// 전체 파이프라인(붙여넣기 → 격자 → 매핑 → 초안 생성)
function importFromHtml(html: string) {
  const grid = parseHtmlTable(html)!
  const { header, dataStart } = resolveHeader(grid, true)
  const colCount = grid.reduce((m, r) => Math.max(m, r.length), 0)
  const padded = Array.from({ length: colCount }, (_, i) => header[i] ?? '')
  const mapping = autoDetectMapping(padded)
  const built = buildCriteria(grid.slice(dataStart), mapping, { hasHeader: false })
  return { grid, header, mapping, built }
}

describe('한글(HWP) 표 붙여넣기', () => {
  it('병합셀(rowspan)이 아래 행으로 채워진 격자로 복원된다', () => {
    const grid = parseHtmlTable(HWP_HTML)!
    // 6행(머리글 + 5지표), 4열
    expect(grid.length).toBe(6)
    expect(grid.every((r) => r.length === 4)).toBe(true)
    // rowspan=2 였던 '사업계획'이 2·3행에 동일하게 채워짐
    expect(grid[1][0]).toBe('사업계획')
    expect(grid[2][0]).toBe('사업계획')
    // '기대효과'도 5·6행에 채워짐
    expect(grid[4][0]).toBe('기대효과')
    expect(grid[5][0]).toBe('기대효과')
  })

  it('&nbsp; 는 일반 공백으로, <br> 여러 줄은 줄바꿈으로 보존된다', () => {
    const grid = parseHtmlTable(HWP_HTML)!
    expect(grid[1][1]).toBe('목표 및 내용') // &nbsp; → 공백
    expect(grid[5][2]).toBe('고용 창출\n경제적 파급') // <br> → \n
  })

  it('머리글이 자동 인식되고 4개 열이 group/subitem/name/maxScore로 매핑된다', () => {
    const { mapping } = importFromHtml(HWP_HTML)
    expect(mapping).toEqual(['group', 'subitem', 'name', 'maxScore'])
  })

  it('평가지표 5개가 경고 없이 생성되고 배점 합이 100이다', () => {
    const { built } = importFromHtml(HWP_HTML)
    expect(built.warnings).toEqual([])
    expect(built.rows.length).toBe(5)
    expect(built.rows.reduce((s, r) => s + r.maxScore, 0)).toBe(100)
    // 병합셀이 각 지표에 올바른 평가항목으로 전파됐는지
    expect(built.rows[0]).toMatchObject({ group: '사업계획', subitem: '목표 및 내용', maxScore: 25 })
    expect(built.rows[1]).toMatchObject({ group: '사업계획', subitem: '추진 체계', maxScore: 15 })
    expect(built.rows[4]).toMatchObject({ group: '기대효과', subitem: '파급효과', maxScore: 10 })
  })

  it('표가 없는 HTML은 null 을 반환한다(붙여넣기 폴백 → TSV 처리)', () => {
    expect(parseHtmlTable('<div>표가 아님</div>')).toBeNull()
    expect(parseHtmlTable('')).toBeNull()
  })
})
