// 평가위원 계정 명단 엑셀 임포트(전역 등록) — 평가위원 관리 테이블에 맞춘 열:
// 이름 / 아이디 / 비밀번호 / 연락처 / 소속 / 직급. 순수 파싱/매핑만(서버·클라 공용).

export type EvalAccountField = 'name' | 'username' | 'phone' | 'password' | 'affiliation' | 'position'

export interface EvalAccountFieldDef {
  field: EvalAccountField
  label: string
  required: boolean
}

export const EVAL_ACCOUNT_FIELDS: EvalAccountFieldDef[] = [
  { field: 'name', label: '이름', required: true },
  { field: 'username', label: '아이디', required: false },
  { field: 'password', label: '비밀번호', required: false },
  { field: 'phone', label: '연락처', required: false },
  { field: 'affiliation', label: '소속', required: false },
  { field: 'position', label: '직급', required: false },
]

const SYNONYMS: Record<EvalAccountField, string[]> = {
  name: ['이름', '성명', '위원', '평가위원', '심사위원', '위원명', '성함', 'name'],
  username: ['아이디', '계정', '계정id', '로그인', '로그인id', 'id', 'username', '이메일', 'email'],
  password: ['비밀번호', '비번', '임시비밀번호', '패스워드', 'password', 'pw', 'pass'],
  phone: ['연락처', '전화번호', '전화', '휴대폰', '휴대전화', '핸드폰', '연락', 'tel', 'hp', 'mobile', 'phone'],
  affiliation: ['소속', '소속기관', '기관', '회사', '소속회사', '근무처', 'affiliation', 'org'],
  position: ['직급', '직위', '직책', '보직', 'position', 'title', 'rank'],
}

function norm(s: string): string {
  return s
    .replace(/[([{][^)\]}]*[)\]}]/g, '')
    .replace(/[\s()[\]{}·.\-_/]/g, '')
    .trim()
    .toLowerCase()
}

export type EvalAccountColumnMapping = (EvalAccountField | null)[]

export function autoDetectEvalAccountMapping(headers: string[]): EvalAccountColumnMapping {
  const result: EvalAccountColumnMapping = headers.map(() => null)
  const used = new Set<EvalAccountField>()
  const keys = headers.map(norm)
  const tryAssign = (mode: 'exact' | 'loose') => {
    headers.forEach((_, i) => {
      if (result[i] !== null) return
      const key = keys[i]
      if (!key) return
      for (const def of EVAL_ACCOUNT_FIELDS) {
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

export function evalAccountLooksLikeHeader(firstRow: string[]): boolean {
  return autoDetectEvalAccountMapping(firstRow).some((f) => f !== null)
}

export interface EvalAccountDraft {
  name: string
  username: string | null
  phone: string | null
  password: string | null
  affiliation: string | null
  position: string | null
}

export interface EvalAccountBuildResult {
  rows: EvalAccountDraft[]
  warnings: string[]
}

export function buildEvalAccounts(
  grid: string[][],
  mapping: EvalAccountColumnMapping,
  opts: { hasHeader: boolean },
): EvalAccountBuildResult {
  const warnings: string[] = []
  const dataRows = opts.hasHeader ? grid.slice(1) : grid
  const col = (f: EvalAccountField) => mapping.findIndex((m) => m === f)
  const nameCol = col('name')
  const userCol = col('username')
  const phoneCol = col('phone')
  const pwCol = col('password')
  const affCol = col('affiliation')
  const posCol = col('position')

  if (nameCol < 0) {
    warnings.push('필수 필드 "이름"이 어느 열에도 매핑되지 않았습니다. 한 열을 "이름"으로 지정하세요.')
    return { rows: [], warnings }
  }

  const val = (r: string[], c: number) => (c >= 0 ? (r[c] ?? '').trim() || null : null)
  const rows: EvalAccountDraft[] = []
  const seen = new Set<string>()
  dataRows.forEach((r) => {
    const name = (r[nameCol] ?? '').trim()
    if (!name || /^(합계|소계|계|이름|성명|위원)$/.test(name)) return
    const username = val(r, userCol)
    const key = (username ?? `name:${name}`).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      name,
      username,
      phone: val(r, phoneCol),
      password: val(r, pwCol),
      affiliation: val(r, affCol),
      position: val(r, posCol),
    })
  })

  if (rows.length === 0) warnings.push('가져올 평가위원이 없습니다. 매핑과 "머리글 포함" 설정을 확인하세요.')
  return { rows, warnings }
}
