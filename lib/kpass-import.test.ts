import { describe, it, expect } from 'vitest'
import {
  parseTsv,
  autoDetectMapping,
  looksLikeHeader,
  resolveHeader,
  buildCriteria,
  type ColumnMapping,
} from './kpass-import'

describe('parseTsv', () => {
  it('탭=열, 개행=행으로 분리', () => {
    expect(parseTsv('a\tb\tc\n1\t2\t3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('따옴표로 감싼 줄바꿈 셀을 한 셀로 유지', () => {
    const tsv = 'name\tdesc\n사업성\t"첫 줄\n둘째 줄"\n시장성\t단순'
    expect(parseTsv(tsv)).toEqual([
      ['name', 'desc'],
      ['사업성', '첫 줄\n둘째 줄'],
      ['시장성', '단순'],
    ])
  })

  it('이스케이프된 따옴표("") 처리', () => {
    expect(parseTsv('a\t"그는 ""야""라 했다"')).toEqual([['a', '그는 "야"라 했다']])
  })

  it('완전히 빈 행은 제거', () => {
    expect(parseTsv('a\tb\n\n\t\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('autoDetectMapping', () => {
  it('동의어로 열을 목표 필드에 매핑', () => {
    expect(autoDetectMapping(['구분', '세부항목', '배점'])).toEqual(['section', 'name', 'maxScore'])
  })

  it('헤더 변형(점수/만점/공백·괄호)도 흡수', () => {
    expect(autoDetectMapping(['대분류', '평가지표', '만점'])).toEqual(['section', 'name', 'maxScore'])
    expect(autoDetectMapping(['평가 항목', '세부 항목명', '배점(점)'])).toEqual(['section', 'name', 'maxScore'])
  })

  it('같은 필드 중복 매칭 시 첫 열만 채택', () => {
    const m = autoDetectMapping(['배점', '점수'])
    expect(m[0]).toBe('maxScore')
    expect(m[1]).toBe(null)
  })

  it('미상 헤더는 null', () => {
    expect(autoDetectMapping(['순번', '비고'])).toEqual([null, null])
  })

  it('부분 포함도 너그럽게 매칭("구분자"·"평가구분"→section)', () => {
    expect(autoDetectMapping(['구분자', '평가지표', '배점'])).toEqual(['section', 'name', 'maxScore'])
    expect(autoDetectMapping(['평가구분', '세부항목명'])).toEqual(['section', 'name'])
  })

  it('괄호 묶음은 제거 후 매칭("배점(점)"→maxScore, "탁월(5)"→grade)', () => {
    expect(autoDetectMapping(['배점(점)'])).toEqual(['maxScore'])
    expect(autoDetectMapping(['탁월(5)', '우수(4)'])).toEqual(['grade', 'grade'])
  })

  it('"평가항목"은 맥락에 따라 대제목/항목명 — 구분이 있으면 평가항목=항목명', () => {
    // 공법선정 양식: 구분=대제목, 평가항목=항목명, 평가기준=설명, 배점, A사~E사=무시
    expect(
      autoDetectMapping(['구분', '평가항목', '평가기준', '배점', 'A사', 'B사', 'C사', 'D사', 'E사']),
    ).toEqual(['section', 'name', 'description', 'maxScore', null, null, null, null, null])
    // 반대 관습: 평가항목=대제목, 세부항목명=항목명
    expect(autoDetectMapping(['평가항목', '세부항목명', '배점'])).toEqual(['section', 'name', 'maxScore'])
  })

  it('공공 양식 헤더 변형 — 평가부문/평가지표/가중치', () => {
    expect(autoDetectMapping(['대분류', '평가요소', '가중치', '배점'])).toEqual([
      'section', 'name', 'weight', 'maxScore',
    ])
    expect(autoDetectMapping(['평가영역', '세부평가내용', '평가관점'])).toEqual([
      'section', 'name', 'description',
    ])
  })

  it('다양한 등급 척도 — 수우미양가 / A~E / 상중하 / 적합부적합', () => {
    expect(autoDetectMapping(['구분', '지표', '수', '우', '미', '양', '가'])).toEqual([
      'section', 'name', 'grade', 'grade', 'grade', 'grade', 'grade',
    ])
    expect(autoDetectMapping(['분야', '지표', 'A', 'B', 'C', 'D', 'E'])).toEqual([
      'section', 'name', 'grade', 'grade', 'grade', 'grade', 'grade',
    ])
    expect(autoDetectMapping(['범주', '검토항목', '상', '중', '하'])).toEqual([
      'section', 'name', 'grade', 'grade', 'grade',
    ])
    expect(autoDetectMapping(['심사항목', '평가내용', '적합', '부적합'])).toEqual([
      'section', 'name', 'grade', 'grade',
    ])
  })
})

describe('resolveHeader — 1행/2행 머리글 자동 판별', () => {
  it('일반 표는 1행 머리글(dataStart=1)', () => {
    const grid = [
      ['구분', '평가지표', '배점'],
      ['기술성', '완성도', '30'],
    ]
    expect(resolveHeader(grid, true)).toEqual({ header: ['구분', '평가지표', '배점'], dataStart: 1 })
  })

  it('2행 머리글(상위 "평점" + 하위 "탁월~불량")을 합쳐 인식(dataStart=2)', () => {
    const grid = [
      ['구분', '평가지표', '평점', '', '', '', ''],
      ['', '', '탁월', '우수', '보통', '미흡', '불량'],
      ['기술성', '완성도', '5', '4', '3', '2', '1'],
    ]
    const { header, dataStart } = resolveHeader(grid, true)
    expect(dataStart).toBe(2)
    expect(header).toEqual(['구분', '평가지표', '탁월', '우수', '보통', '미흡', '불량'])
  })

  it('헤더 없음 설정이면 빈 헤더(dataStart=0)', () => {
    expect(resolveHeader([['a', 'b']], false)).toEqual({ header: [], dataStart: 0 })
  })
})

describe('looksLikeHeader', () => {
  it('동의어가 하나라도 있으면 헤더로 간주', () => {
    expect(looksLikeHeader(['구분', '세부항목', '배점'])).toBe(true)
    expect(looksLikeHeader(['사업성', '시장성 평가', '30'])).toBe(false)
  })
})

describe('buildCriteria', () => {
  const grid = [
    ['구분', '세부항목', '배점'],
    ['사업성', '시장 진입 가능성', '30'],
    ['기술성', '기술 완성도', '20점'],
  ]
  const mapping: ColumnMapping = ['section', 'name', 'maxScore']

  it('헤더 제외하고 행을 Criterion 초안으로 변환', () => {
    const { rows, warnings } = buildCriteria(grid, mapping, { hasHeader: true })
    expect(warnings).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ section: '사업성', name: '시장 진입 가능성', type: 'QUANTITATIVE', maxScore: 30, weight: 1 })
  })

  it('"20점"처럼 단위 섞인 배점도 숫자 추출', () => {
    const { rows } = buildCriteria(grid, mapping, { hasHeader: true })
    expect(rows[1].maxScore).toBe(20)
  })

  it('이름 없는 행은 조용히 스킵', () => {
    const g = [...grid, ['소계', '', '50']]
    const { rows } = buildCriteria(g, mapping, { hasHeader: true })
    expect(rows).toHaveLength(2)
  })

  it('name 미매핑이면 경고 후 빈 결과', () => {
    const { rows, warnings } = buildCriteria(grid, ['section', null, 'maxScore'], { hasHeader: true })
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/세부항목명/)
  })

  it('배점이 숫자가 아니면 만점 0 + 경고', () => {
    const g = [
      ['세부항목', '배점'],
      ['항목A', '해당없음'],
    ]
    const { rows, warnings } = buildCriteria(g, ['name', 'maxScore'], { hasHeader: true })
    expect(rows[0].maxScore).toBe(0)
    expect(warnings.some((w) => w.includes('항목A'))).toBe(true)
  })

  it('all-qualitative 모드는 기본 A~E 등급 생성', () => {
    const { rows } = buildCriteria(grid, mapping, { hasHeader: true, typeMode: 'all-qualitative' })
    expect(rows[0].type).toBe('QUALITATIVE')
    expect(rows[0].gradeOptions).toHaveLength(5)
    expect(rows[0].gradeOptions?.[0]).toMatchObject({ points: 30 }) // A=만점
  })

  it('헤더 없음 설정이면 첫 행도 데이터로', () => {
    const g = [
      ['사업성', '시장성', '30'],
      ['기술성', '완성도', '20'],
    ]
    const { rows } = buildCriteria(g, mapping, { hasHeader: false })
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('시장성')
  })
})

describe('buildCriteria — 정성 등급 척도표(grade)', () => {
  const grid = [
    ['구분', '평가지표', '탁월', '우수', '보통', '미흡', '불량'],
    ['기술성 (25)', '방향 적정성', '5', '4', '3', '2', '1'],
    ['', '접근 방법', '15', '12', '9', '6', '3'],
    ['지역특화 (20)', '연구 인프라', '5', '', '3', '', '1'], // 가로 병합셀
    ['합계 (100)', '', '', '', '', '', ''],
  ]
  const map = autoDetectMapping(grid[0])

  it('탁월~불량 헤더는 grade로, 구분/평가지표는 section/name으로 자동 매핑', () => {
    expect(map).toEqual(['section', 'name', 'grade', 'grade', 'grade', 'grade', 'grade'])
  })

  it('등급 열 → gradeOptions(정성), maxScore=최댓값', () => {
    const { rows } = buildCriteria(grid, map, { hasHeader: true })
    expect(rows[0]).toMatchObject({ name: '방향 적정성', type: 'QUALITATIVE', maxScore: 5 })
    expect(rows[0].gradeOptions).toEqual([
      { label: '탁월', points: 5 },
      { label: '우수', points: 4 },
      { label: '보통', points: 3 },
      { label: '미흡', points: 2 },
      { label: '불량', points: 1 },
    ])
  })

  it('병합셀(구분) 세로 채움 + "(25)" 합계 표기 제거', () => {
    const { rows } = buildCriteria(grid, map, { hasHeader: true })
    expect(rows[0].section).toBe('기술성')
    expect(rows[1].section).toBe('기술성') // 빈 구분 → 위 값 이어받음
  })

  it('등급 가로 병합셀은 직전 점수로 채움', () => {
    const { rows } = buildCriteria(grid, map, { hasHeader: true })
    const infra = rows.find((r) => r.name === '연구 인프라')!
    expect(infra.gradeOptions).toEqual([
      { label: '탁월', points: 5 },
      { label: '우수', points: 5 },
      { label: '보통', points: 3 },
      { label: '미흡', points: 3 },
      { label: '불량', points: 1 },
    ])
  })

  it('합계 행은 건너뜀', () => {
    const { rows } = buildCriteria(grid, map, { hasHeader: true })
    expect(rows).toHaveLength(3)
    expect(rows.some((r) => r.name.includes('합계'))).toBe(false)
  })
})
