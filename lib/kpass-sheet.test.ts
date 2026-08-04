import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseSheet } from './kpass-sheet'

// 결정적 테스트: xlsx 라이브러리로 워크북 버퍼를 만들어 parseSheet의 격자 변환을 검증.
// (파일/네트워크 없이 메모리 버퍼만 사용 → node 단위 테스트로 적합)
function toBuffer(aoa: unknown[][], opts?: { sheetName?: string; extraSheet?: unknown[][] }): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, opts?.sheetName ?? 'Sheet1')
  if (opts?.extraSheet) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(opts.extraSheet), 'Second')
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('parseSheet', () => {
  it('행/열 격자를 string[][]로 반환', () => {
    const buf = toBuffer([
      ['구분', '평가지표', '배점'],
      ['기술성', '완성도', '30'],
    ])
    expect(parseSheet(buf)).toEqual([
      ['구분', '평가지표', '배점'],
      ['기술성', '완성도', '30'],
    ])
  })

  it('숫자 셀도 문자열로 변환', () => {
    const buf = toBuffer([['항목', 30], ['비율', 0]])
    const grid = parseSheet(buf)
    expect(grid[0]).toEqual(['항목', '30'])
    expect(grid[1]).toEqual(['비율', '0'])
    expect(typeof grid[0][1]).toBe('string')
  })

  it('앞뒤 공백은 trim 처리', () => {
    const buf = toBuffer([['  구분  ', '\t평가지표\n']])
    expect(parseSheet(buf)).toEqual([['구분', '평가지표']])
  })

  it('빈 셀은 빈 문자열로 자리 유지(defval)', () => {
    // 2열짜리 시트에서 한 셀만 값 → 나머지는 '' 로 채워짐
    const buf = toBuffer([
      ['a', 'b'],
      ['c', ''],
    ])
    expect(parseSheet(buf)).toEqual([
      ['a', 'b'],
      ['c', ''],
    ])
  })

  it('짧은 행은 최대 열 수에 맞춰 빈 문자열로 패딩', () => {
    // 둘째 행이 한 칸 짧아도 defval 로 자리 유지되어 열 정렬 보존
    const buf = toBuffer([
      ['a', 'b', 'c'],
      ['x', 'y'],
    ])
    expect(parseSheet(buf)).toEqual([
      ['a', 'b', 'c'],
      ['x', 'y', ''],
    ])
  })

  it('첫 번째 시트만 읽는다', () => {
    const buf = toBuffer([['first-sheet']], { extraSheet: [['second-sheet']] })
    expect(parseSheet(buf)).toEqual([['first-sheet']])
  })

  it('데이터가 전혀 없는 시트는 빈 배열', () => {
    const buf = toBuffer([])
    expect(parseSheet(buf)).toEqual([])
  })

  it('숫자·불리언 혼합 셀도 문자열 격자로 정규화', () => {
    const buf = toBuffer([['라벨', 5, true]])
    expect(parseSheet(buf)).toEqual([['라벨', '5', 'true']])
  })

  // CSV 업로드 — 버퍼로 넘기면 codepage 오해로 한글이 깨진다(íê°í­ëª©). UTF-8 텍스트로 읽어야 한다.
  it('UTF-8 CSV(BOM 없음)의 한글이 깨지지 않는다', () => {
    const buf = Buffer.from('평가항목,세부항목,평가지표,배점\n사업계획,목표,지표,25\n', 'utf-8')
    expect(parseSheet(buf)).toEqual([
      ['평가항목', '세부항목', '평가지표', '배점'],
      ['사업계획', '목표', '지표', '25'],
    ])
  })

  it('UTF-8 CSV(BOM 있음)도 BOM을 떼고 정상 처리', () => {
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('평가항목,배점\n사업계획,25\n', 'utf-8'),
    ])
    expect(parseSheet(buf)).toEqual([
      ['평가항목', '배점'],
      ['사업계획', '25'],
    ])
  })

  it('TSV(탭 구분) 텍스트도 한글 유지하며 격자로 변환', () => {
    const buf = Buffer.from('평가항목\t배점\n사업계획\t25\n', 'utf-8')
    expect(parseSheet(buf)).toEqual([
      ['평가항목', '배점'],
      ['사업계획', '25'],
    ])
  })

  // EUC-KR(CP949) CSV — 구형 윈도우 엑셀 기본 인코딩. 유효 UTF-8이 아니라 자동 감지된다.
  // 바이트는 '평가항목,세부항목,평가지표,배점\n사업계획,목표,지표,25\n'의 CP949 인코딩.
  it('EUC-KR(CP949) CSV의 한글을 자동 감지해 정상 처리', () => {
    const buf = Buffer.from(
      'c6f2b0a1c7d7b8f12cbcbcbacec7d7b8f12cc6f2b0a1c1f6c7a52cb9e8c1a10abbe7bef7b0e8c8b92cb8f1c7a52cc1f6c7a52c32350a',
      'hex',
    )
    expect(parseSheet(buf)).toEqual([
      ['평가항목', '세부항목', '평가지표', '배점'],
      ['사업계획', '목표', '지표', '25'],
    ])
  })
})
