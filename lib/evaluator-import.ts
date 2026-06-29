// 평가위원 명단 엑셀 임포트 — 순수 파싱/매핑(서버·클라 공용). 격자(string[][])는 parseTsv(붙여넣기)
// 또는 parseSheet(파일)로 얻는다. 여기선 매핑 적용·검증만.

export type EvaluatorField = 'name' | 'username' | 'phone'

export interface EvalFieldDef {
  field: EvaluatorField
  label: string
  required: boolean
}

export const EVALUATOR_FIELDS: EvalFieldDef[] = [
  { field: 'name', label: '성명', required: true },
  { field: 'username', label: '아이디/이메일(있으면)', required: false },
  { field: 'phone', label: '연락처', required: false },
]

const SYNONYMS: Record<EvaluatorField, string[]> = {
  name: ['성명', '위원성명', '평가위원명', '심사위원명', '위원명', '평가위원', '심사위원', '위원', '이름', '성함'],
  username: ['아이디', 'id', '이메일주소', '이메일', 'email', '메일', '위원id', '위원번호', '로그인id', '로그인', '계정id', '계정', '사번'],
  phone: ['연락처', '전화번호', '전화', '휴대폰', '휴대전화', '핸드폰', '연락', '전화(휴대폰)', 'tel', 'hp', 'mobile', 'phone'],
}

function norm(s: string): string {
  return s
    .replace(/[([{][^)\]}]*[)\]}]/g, '') // 괄호 묶음 통째 제거
    .replace(/[\s()[\]{}·.\-_/]/g, '')
    .trim()
    .toLowerCase()
}

export type EvalColumnMapping = (EvaluatorField | null)[]

// 정확 일치 → 부분 포함 2단계(너그러운 매칭). kpass-import.autoDetectMapping과 동일 정책.
export function autoDetectEvaluatorMapping(headers: string[]): EvalColumnMapping {
  const result: EvalColumnMapping = headers.map(() => null)
  const used = new Set<EvaluatorField>()
  const keys = headers.map(norm)
  const tryAssign = (mode: 'exact' | 'loose') => {
    headers.forEach((_, i) => {
      if (result[i] !== null) return
      const key = keys[i]
      if (!key) return
      for (const def of EVALUATOR_FIELDS) {
        if (used.has(def.field)) continue
        const hit = SYNONYMS[def.field].some((syn) => {
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
  tryAssign('exact')
  tryAssign('loose')
  return result
}

export function evaluatorLooksLikeHeader(firstRow: string[]): boolean {
  return autoDetectEvaluatorMapping(firstRow).some((f) => f !== null)
}

export interface EvaluatorDraft {
  name: string
  username: string | null // 비었으면 가져오기 시 자동 생성
  phone: string | null
}

export interface EvalBuildResult {
  rows: EvaluatorDraft[]
  warnings: string[]
}

export function buildEvaluators(
  grid: string[][],
  mapping: EvalColumnMapping,
  opts: { hasHeader: boolean },
): EvalBuildResult {
  const warnings: string[] = []
  const dataRows = opts.hasHeader ? grid.slice(1) : grid
  const nameCol = mapping.findIndex((f) => f === 'name')
  const userCol = mapping.findIndex((f) => f === 'username')
  const phoneCol = mapping.findIndex((f) => f === 'phone')

  if (nameCol < 0) {
    warnings.push('필수 필드 "성명"이 어느 열에도 매핑되지 않았습니다. 한 열을 "성명"으로 지정하세요.')
    return { rows: [], warnings }
  }

  const rows: EvaluatorDraft[] = []
  const seen = new Set<string>()
  dataRows.forEach((r) => {
    const name = (r[nameCol] ?? '').trim()
    if (!name || /^(합계|소계|계|성명|이름)$/.test(name)) return
    const username = userCol >= 0 ? (r[userCol] ?? '').trim() || null : null
    const phone = phoneCol >= 0 ? (r[phoneCol] ?? '').trim() || null : null
    const key = (username ?? `name:${name}`).toLowerCase()
    if (seen.has(key)) return // 같은 입력 내 중복 제거
    seen.add(key)
    rows.push({ name, username, phone })
  })

  if (rows.length === 0) warnings.push('가져올 위원이 없습니다. 매핑과 "헤더 포함" 설정을 확인하세요.')
  return { rows, warnings }
}
