// K-PASS(또는 임의 양식) 평가표 엑셀 임포트 — 순수 파싱/매핑 유틸 (서버·클라 공용, 사이드이펙트 없음).
// 입력 양식이 제각각이므로 "코드로 형식을 흡수"하지 않고, 들어온 열을 목표 필드에
// 사람이 매핑(대화형)하는 구조. 여기서는 그 매핑을 적용·검증하는 순수 로직만 다룬다.
import { defaultGradeOptions, type GradeOption } from './scoring'

// 매핑 대상이 되는 Criterion 목표 필드 — 화면 표의 3단 구조에 1:1 대응.
//   group   = 평가항목(대분류/그룹)
//   subitem = 세부항목(중분류)
//   name    = 평가지표(리프, 실제 채점 대상) — 필수. 평가지표가 없으면 세부항목을 리프로 대체.
// 'grade' = 정성 등급 척도 한 칸(예: 탁월/우수/보통/미흡/불량). 여러 열이 동시에 grade로 매핑될 수 있다.
export type CriterionField = 'group' | 'subitem' | 'name' | 'maxScore' | 'weight' | 'grade'

export interface FieldDef {
  field: CriterionField
  label: string
  required: boolean
}

// UI 드롭다운에 노출할 목표 필드 정의(순서 = 표시 순서 = 자동매핑 우선순위)
export const CRITERION_FIELDS: FieldDef[] = [
  { field: 'group', label: '평가항목', required: false },
  { field: 'subitem', label: '세부항목', required: false },
  { field: 'name', label: '평가지표', required: true },
  { field: 'maxScore', label: '배점(만점)', required: false },
  { field: 'grade', label: '평점(등급별 점수)', required: false },
  { field: 'weight', label: '가중치', required: false },
]

// 헤더 동의어 맵 — 자동 매핑 추측용. 정규화(공백/괄호 제거, 소문자)된 헤더와 비교.
// 공공/정부 평가표·심사표의 실제 표현 변형을 폭넓게 수집해 반영(정확 일치 우선 → 부분 포함).
const SYNONYMS: Record<CriterionField, string[]> = {
  // 평가항목(대분류/그룹)
  group: [
    '평가항목', '구분', '대분류', '대항목', '평가부문', '부문', '평가영역', '영역',
    '평가분야', '분야', '평가범주', '범주', '심사부문', '심사구분', '평가구분', '심사항목',
  ],
  // 세부항목(중분류)
  subitem: [
    '세부항목', '세부항목명', '세부평가항목', '세부평가내용', '세부내용', '세부기준', '중항목', '중분류',
  ],
  // 평가지표(리프, 실제 채점 대상)
  name: [
    '평가지표', '지표', '지표명', '세부지표', '평가요소', '요소', '평가내용', '검토항목',
    '심사지표', '심사세부항목', '항목명', '내용',
  ],
  maxScore: [
    '배점', '만점', '평가점수', '최대점수', '기준점수', '배점기준', '득점', '점수', 'score',
  ], // 주의: '평점'은 등급 묶음 머리글이라 배점에 넣지 않음
  weight: ['가중치', '가중', '비중', '반영비율', '배점비율', '반영', 'weight'],
  // 정성 등급 척도(여러 열). 정확 일치만. 기관별 척도 변형 망라.
  grade: [
    // 5단계 서술형
    '탁월', '매우우수', '우수', '보통', '미흡', '매우미흡', '불량', '미달', '저조',
    // 수우미양가
    '수', '우', '미', '양', '가',
    // 알파벳 척도(S~F)
    's', 'a', 'b', 'c', 'd', 'e', 'f',
    // 3단계
    '상', '중', '하',
    // 적합형
    '적합', '부분적합', '부적합', '충족', '부분충족', '미충족',
  ],
}

// 대체(fallback) 동의어 — 주 동의어로 평가지표(leaf)를 못 잡았을 때만 적용.
// 예: "구분 + 평가항목" → 구분=평가항목(그룹), 남은 '평가항목' 열은 평가지표(리프)로.
const FALLBACK_SYNONYMS: Partial<Record<CriterionField, string[]>> = {
  name: ['평가항목', '항목', '심사항목'],
}

// 같은 머리글이 여러 열에 등장할 수 있어 중복 매핑을 허용하는 필드(정성 등급 척도)
const MULTI_FIELDS = new Set<CriterionField>(['grade'])

// 헤더/셀 정규화: 괄호 묶음은 통째 제거(배점(점)→배점), 남은 공백·특수문자 제거 후 소문자
function norm(s: string): string {
  return s
    .replace(/[([{][^)\]}]*[)\]}]/g, '') // (점)·[비고] 같은 괄호 묶음 제거
    .replace(/[\s()[\]{}·.\-_/]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * 엑셀에서 셀 범위를 복사하면 클립보드에 TSV가 담긴다(열=\t, 행=\n, 줄바꿈 포함 셀은 "..."로 감쌈).
 * 따옴표·줄바꿈 셀을 올바로 처리하는 파서. 빈 끝줄은 버린다.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  // 마지막 셀/행 마무리
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  // 완전히 빈 행 제거(모든 셀이 공백)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// 열 인덱스 → 목표 필드(또는 null=무시). UI가 이 형태를 들고 다닌다.
export type ColumnMapping = (CriterionField | null)[]

/**
 * 헤더 행을 동의어 맵에 대조해 열별 목표 필드를 사전 추측.
 * 단일 필드(name/section 등)는 첫 열만 채택, 다중 필드(grade)는 여러 열에 반복 허용.
 *
 * 2단계 매칭(정확 우선 → 부분 포함). 부분 포함은 일부러 너그럽게 둔다:
 * "구분자"·"평가구분"처럼 동의어를 포함하기만 해도 잡아 매핑 손이 덜 가게 한다.
 * (괄호 묶음은 norm에서 제거 → "배점(점)"=배점) 등급(grade)은 과매칭 방지로 정확 일치만.
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const result: ColumnMapping = headers.map(() => null)
  const used = new Set<CriterionField>()
  const keys = headers.map(norm)

  const pass = (table: Partial<Record<CriterionField, string[]>>, mode: 'exact' | 'loose') => {
    headers.forEach((_, i) => {
      if (result[i] !== null) return
      const key = keys[i]
      if (!key) return
      for (const def of CRITERION_FIELDS) {
        if (used.has(def.field) && !MULTI_FIELDS.has(def.field)) continue
        // 등급은 부분 포함 단계를 건너뛰고 정확 일치만 허용
        if (MULTI_FIELDS.has(def.field) && mode !== 'exact') continue
        const syns = table[def.field]
        if (!syns) continue
        const hit = syns.some((syn) => {
          const s = norm(syn)
          return s && (mode === 'exact' ? key === s : key.includes(s))
        })
        if (hit) {
          result[i] = def.field
          used.add(def.field)
          break
        }
      }
    })
  }

  // 주 동의어 우선(정확→부분), 그 뒤 대체 동의어(정확→부분)
  pass(SYNONYMS, 'exact')
  pass(SYNONYMS, 'loose')
  pass(FALLBACK_SYNONYMS, 'exact')
  pass(FALLBACK_SYNONYMS, 'loose')
  return result
}

// 2행 머리글(예: 상위 "평점" 병합 + 하위 "탁월/우수/…")을 한 줄로 합침.
// 각 열: 하위 행 라벨이 있으면 그것(말단), 없으면 상위 행(가로 병합은 forward-fill)을 쓴다.
function mergeHeaderRows(row0: string[], row1: string[]): string[] {
  const n = Math.max(row0.length, row1.length)
  const out: string[] = []
  let carry = ''
  for (let c = 0; c < n; c++) {
    const top = (row0[c] ?? '').trim()
    if (top) carry = top // 가로 병합셀: 직전 상위 라벨 이어받기
    const sub = (row1[c] ?? '').trim()
    out.push(sub || carry)
  }
  return out
}

/**
 * 헤더 행 해석. 첫 행만으로 vs 첫 2행을 합쳐 매핑했을 때 더 많은 열이 잡히면 2행 머리글로 본다.
 * (예: "평점" 상위 + "탁월~불량" 하위 → 합쳐야 등급 5열이 잡힘. 일반 표는 2행=데이터라 합치면 매핑이 줄어듦.)
 */
export function resolveHeader(grid: string[][], hasHeader: boolean): { header: string[]; dataStart: number } {
  if (!hasHeader || grid.length === 0) return { header: [], dataStart: 0 }
  const row0 = grid[0]
  if (grid.length >= 2) {
    const merged = mergeHeaderRows(row0, grid[1])
    const baseCount = autoDetectMapping(row0).filter(Boolean).length
    const mergedCount = autoDetectMapping(merged).filter(Boolean).length
    if (mergedCount > baseCount) return { header: merged, dataStart: 2 }
  }
  return { header: row0, dataStart: 1 }
}

// 줄머리 불릿(-, ·, •, ※, * 등) 제거. 여러 줄 셀은 줄마다 적용.
function stripBullets(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/^\s*[-–—•·▪‣*※○●◦□☐∙]+\s*/, '').trimEnd())
    .join('\n')
    .trim()
}

// 섹션/이름에서 "기술성 (25)" 같은 배점 합계 표기 제거
function stripTotal(s: string): string {
  return s.replace(/[\s(]*\d+\s*[점]?\s*\)?\s*$/, '').trim() || s.trim()
}

// 합계/소계 등 집계 행 판별(가져오기에서 제외)
function isSummaryName(s: string): boolean {
  return /^(합계|총계|소계|계|총점)$/.test(s.replace(/[\s(]*\d+.*$/, '').trim())
}

/** 첫 행이 헤더처럼 보이는지(동의어에 하나라도 매칭) — "헤더 포함" 기본값 추론용. */
export function looksLikeHeader(firstRow: string[]): boolean {
  return autoDetectMapping(firstRow).some((f) => f !== null)
}

export interface BuildOptions {
  hasHeader: boolean
  // 'auto' = 배점 열이 숫자면 정량, 아니면 정성 / 'all-quantitative' / 'all-qualitative'
  typeMode?: 'auto' | 'all-quantitative' | 'all-qualitative'
}

export interface CriterionDraft {
  group: string | null // 평가항목
  subitem: string | null // 세부항목 (없으면 커밋에서 평가지표명으로 대체)
  name: string // 평가지표(리프)
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  maxScore: number
  weight: number
  gradeOptions: GradeOption[] | null
  // 이 행에 배점이 실제로 적혀 있었는지(병합셀로 비어 있던 행 구분용). 통합배점 판별에 사용.
  scoreProvided: boolean
}

export interface BuildResult {
  rows: CriterionDraft[]
  warnings: string[]
}

function toNumber(raw: string): number | null {
  if (!raw) return null
  // "30점", "30 점", "30.0" 등에서 숫자만 추출
  const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * 정규화된 grid + 사용자 확정 매핑 → Criterion 초안 목록 + 경고.
 * DB 접근 없음(순수). 서버 액션이 이 결과를 그대로 createMany 한다.
 */
export function buildCriteria(grid: string[][], mapping: ColumnMapping, opts: BuildOptions): BuildResult {
  const warnings: string[] = []
  const { header: headerRow, dataStart } = resolveHeader(grid, opts.hasHeader)
  const dataRows = grid.slice(dataStart)

  const colOf = (field: CriterionField): number => mapping.findIndex((f) => f === field)
  const groupCol = colOf('group')
  const subitemCol = colOf('subitem')
  const nameCol = colOf('name')
  const scoreCol = colOf('maxScore')
  const weightCol = colOf('weight')
  const gradeCols = mapping.map((f, i) => (f === 'grade' ? i : -1)).filter((i) => i >= 0)

  // 리프(평가지표) 열: 평가지표가 매핑됐으면 그것, 아니면 세부항목을 리프로 대체.
  const leafCol = nameCol >= 0 ? nameCol : subitemCol
  // 세부항목 레벨은 평가지표·세부항목이 '둘 다' 매핑됐을 때만 별도 존재(그렇지 않으면 리프가 곧 세부항목).
  const hasSubitemLevel = nameCol >= 0 && subitemCol >= 0

  if (leafCol < 0) {
    warnings.push('필수 필드 "평가지표"가 어느 열에도 매핑되지 않았습니다. 한 열을 "평가지표"(또는 "세부항목")로 지정하세요.')
    return { rows: [], warnings }
  }

  const typeMode = opts.typeMode ?? 'auto'
  const rows: CriterionDraft[] = []
  let lastGroup: string | null = null // 병합셀(평가항목) 세로 채움
  let lastSubitem: string | null = null // 병합셀(세부항목) 세로 채움

  dataRows.forEach((r, idx) => {
    const lineNo = idx + dataStart + 1 // 사용자 기준 행 번호(헤더 행 수 반영)

    // 평가항목: 값이 있으면 갱신, 비었으면 위 행 값 이어받기(병합셀). "(25)" 같은 합계 표기 제거.
    if (groupCol >= 0) {
      const raw = (r[groupCol] ?? '').trim()
      if (raw) lastGroup = stripTotal(raw) || null
    }
    const group = groupCol >= 0 ? lastGroup : null

    // 세부항목: 병합셀 세로 채움(평가지표와 별도로 매핑됐을 때만)
    if (hasSubitemLevel) {
      const raw = (r[subitemCol] ?? '').trim()
      if (raw) lastSubitem = stripBullets(stripTotal(raw)) || null
    }
    const subitem = hasSubitemLevel ? lastSubitem : null

    const name = stripBullets((r[leafCol] ?? '').trim())
    if (!name || isSummaryName(name) || isSummaryName((r[groupCol] ?? '').trim())) {
      return // 빈 행·합계/소계 행 스킵
    }

    const weight = weightCol >= 0 ? toNumber(r[weightCol] ?? '') ?? 1 : 1

    let type: 'QUANTITATIVE' | 'QUALITATIVE'
    let maxScore: number
    let gradeOptions: GradeOption[] | null = null
    let scoreProvided = false

    if (gradeCols.length > 0) {
      // 정성 등급 척도: 각 grade 열 = (머리글 라벨, 셀 점수). 가로 병합셀은 직전 점수로 채움.
      type = 'QUALITATIVE'
      const opts2: GradeOption[] = []
      let lastPoints = NaN
      gradeCols.forEach((c, k) => {
        const label = (headerRow[c] ?? '').trim() || `등급${k + 1}`
        let p = toNumber(r[c] ?? '')
        if (p === null && Number.isFinite(lastPoints)) p = lastPoints // 가로 병합셀
        if (p !== null) {
          opts2.push({ label, points: p })
          lastPoints = p
        }
      })
      if (opts2.length === 0) {
        warnings.push(`${lineNo}행 "${name}": 등급 점수를 읽지 못해 건너뜁니다.`)
        return
      }
      gradeOptions = opts2
      maxScore = Math.max(...opts2.map((o) => o.points))
      scoreProvided = true
    } else {
      const scoreRaw = scoreCol >= 0 ? (r[scoreCol] ?? '').trim() : ''
      const scoreNum = toNumber(scoreRaw)
      scoreProvided = scoreNum !== null
      type = typeMode === 'all-qualitative' ? 'QUALITATIVE' : 'QUANTITATIVE'
      if (type === 'QUALITATIVE') {
        // 등급 열이 없는 정성 → 배점 기준 기본 A~E 등급 자동 생성
        maxScore = scoreNum ?? 0
        gradeOptions = defaultGradeOptions(maxScore || 0)
        if (scoreNum === null) {
          warnings.push(`${lineNo}행 "${name}": 정성 항목인데 배점이 없어 만점 0으로 생성됩니다.`)
        }
      } else if (scoreNum === null) {
        // 배점을 숫자로 읽지 못한 정량 행. 셀이 '비어 있으면' 통합배점(병합셀)의 하위 지표일 수 있어
        // 경고하지 않고 만점 0으로 둔다(통합 여부는 foldCriteria에서 판별). 값이 있는데 숫자가 아니면(오타) 경고.
        maxScore = 0
        if (scoreRaw !== '') {
          warnings.push(`${lineNo}행 "${name}": 배점을 숫자로 읽지 못했습니다("${scoreRaw}"). 만점 0으로 생성됩니다.`)
        }
      } else {
        maxScore = scoreNum
      }
    }

    rows.push({ group, subitem, name, type, maxScore, weight, gradeOptions, scoreProvided })
  })

  if (rows.length === 0) {
    warnings.push('가져올 항목이 없습니다. 매핑과 "헤더 포함" 설정을 확인하세요.')
  }
  return { rows, warnings }
}

// ── 평탄 초안 → 3단 트리(평가항목→세부항목→평가지표) + 통합배점 판별 ──
// 커밋(DB 저장)과 미리보기가 같은 규칙을 쓰도록 순수 함수로 공유한다.
export interface FoldedLeaf {
  name: string
  maxScore: number // 통합배점 세부항목이면 0(채점은 세부항목 단위)
  weight: number
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  gradeOptions: GradeOption[] | null
}
export interface FoldedSubitem {
  name: string
  // null = 지표별 배점, 값 = 세부항목 통합배점(퉁 채점)
  lumpScore: number | null
  leaves: FoldedLeaf[]
}
export interface FoldedGroup {
  name: string
  maxScore: number
  subitems: FoldedSubitem[]
}

/**
 * 세부항목 통합배점 판별:
 * 배점이 세부항목 단위(병합셀)로 매겨져 여러 지표가 '하나의 같은 배점'을 공유하면 통합배점으로 접는다.
 * 병합셀은 파서에 따라 (a) 첫 행만 값·나머지 빈칸 또는 (b) 모든 행에 같은 값이 복제되어 들어오므로,
 * 파서에 의존하지 않도록 "적힌 배점의 서로 다른 값이 1종뿐"인지로 판별한다.
 * 조건 — 모두 정량 & 지표 2개 이상 & 배점이 적힌 지표가 1개 이상 & 그 값이 전부 동일(1종).
 * 이때 lumpScore = 그 공통 배점(합이 아니라 값 1개), 각 지표 배점은 0(채점은 세부항목 단위).
 * 그 외(지표마다 배점이 다름/1개 지표/정성)는 지표별 배점 유지.
 */
export function foldCriteria(rows: CriterionDraft[]): FoldedGroup[] {
  type SB = { name: string; drafts: CriterionDraft[] }
  type GB = { name: string; subs: SB[]; byName: Map<string, SB> }
  const gs: GB[] = []
  const gByName = new Map<string, GB>()
  for (const r of rows) {
    const gName = r.group?.trim() || '기타'
    const sName = r.subitem?.trim() || r.name // 세부항목 없으면 지표명이 곧 세부항목
    let g = gByName.get(gName)
    if (!g) {
      g = { name: gName, subs: [], byName: new Map() }
      gByName.set(gName, g)
      gs.push(g)
    }
    let s = g.byName.get(sName)
    if (!s) {
      s = { name: sName, drafts: [] }
      g.byName.set(sName, s)
      g.subs.push(s)
    }
    s.drafts.push(r)
  }

  return gs.map((g) => {
    const subitems: FoldedSubitem[] = g.subs.map((s) => {
      const providedVals = s.drafts.filter((d) => d.scoreProvided).map((d) => d.maxScore)
      const distinct = [...new Set(providedVals)]
      const allQuant = s.drafts.every((d) => d.type === 'QUANTITATIVE')
      // 지표 2개 이상이 '동일한 배점 1종'만 가지면(병합셀 공유) 통합배점
      const isLump = allQuant && s.drafts.length > 1 && providedVals.length >= 1 && distinct.length === 1
      const lumpScore = isLump ? distinct[0] : null
      return {
        name: s.name,
        lumpScore,
        leaves: s.drafts.map((d) => ({
          name: d.name,
          maxScore: isLump ? 0 : d.maxScore,
          weight: d.weight,
          type: d.type,
          gradeOptions: d.gradeOptions,
        })),
      }
    })
    const maxScore = subitems.reduce(
      (sum, s) => sum + (s.lumpScore ?? s.leaves.reduce((a, l) => a + l.maxScore, 0)),
      0,
    )
    return { name: g.name, maxScore, subitems }
  })
}
