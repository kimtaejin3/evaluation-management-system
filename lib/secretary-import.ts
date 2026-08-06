// 담당자 명단 엑셀 임포트 — 순수 파싱/매핑(서버·클라 공용). 현재 담당자 관리 테이블에 맞춘
// 열: 이름 / 아이디 / 비밀번호 / 연락처. 여기선 매핑 적용·검증만.

export type SecretaryField = 'name' | 'username' | 'phone' | 'password'

export interface SecretaryFieldDef {
  field: SecretaryField
  label: string
  required: boolean
}

export const SECRETARY_FIELDS: SecretaryFieldDef[] = [
  { field: 'name', label: '이름', required: true },
  { field: 'username', label: '아이디', required: false },
  { field: 'password', label: '비밀번호', required: false },
  { field: 'phone', label: '연락처', required: false },
]

const SYNONYMS: Record<SecretaryField, string[]> = {
  name: ['이름', '성명', '담당자', '담당자명', '담당자이름', '성함', 'name'],
  username: ['아이디', '계정', '계정id', '로그인', '로그인id', 'id', 'username', '이메일', 'email'],
  password: ['비밀번호', '비번', '임시비밀번호', '패스워드', 'password', 'pw', 'pass'],
  phone: ['연락처', '전화번호', '전화', '휴대폰', '휴대전화', '핸드폰', '연락', 'tel', 'hp', 'mobile', 'phone'],
}

function norm(s: string): string {
  return s
    .replace(/[([{][^)\]}]*[)\]}]/g, '')
    .replace(/[\s()[\]{}·.\-_/]/g, '')
    .trim()
    .toLowerCase()
}

export type SecretaryColumnMapping = (SecretaryField | null)[]

// 정확 일치 → 부분 포함 2단계(너그러운 매칭). 다른 임포트들과 동일 정책.
export function autoDetectSecretaryMapping(headers: string[]): SecretaryColumnMapping {
  const result: SecretaryColumnMapping = headers.map(() => null)
  const used = new Set<SecretaryField>()
  const keys = headers.map(norm)
  const tryAssign = (mode: 'exact' | 'loose') => {
    headers.forEach((_, i) => {
      if (result[i] !== null) return
      const key = keys[i]
      if (!key) return
      for (const def of SECRETARY_FIELDS) {
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

export function secretaryLooksLikeHeader(firstRow: string[]): boolean {
  return autoDetectSecretaryMapping(firstRow).some((f) => f !== null)
}

export interface SecretaryDraft {
  name: string
  username: string | null // 비었으면 가져오기 시 자동 생성
  phone: string | null
  password: string | null // 비었으면 연락처 끝 4자리, 그것도 없으면 자동 생성
}

export interface SecretaryBuildResult {
  rows: SecretaryDraft[]
  warnings: string[]
}

export function buildSecretaries(
  grid: string[][],
  mapping: SecretaryColumnMapping,
  opts: { hasHeader: boolean },
): SecretaryBuildResult {
  const warnings: string[] = []
  const dataRows = opts.hasHeader ? grid.slice(1) : grid
  const nameCol = mapping.findIndex((f) => f === 'name')
  const userCol = mapping.findIndex((f) => f === 'username')
  const phoneCol = mapping.findIndex((f) => f === 'phone')
  const pwCol = mapping.findIndex((f) => f === 'password')

  if (nameCol < 0) {
    warnings.push('필수 필드 "이름"이 어느 열에도 매핑되지 않았습니다. 한 열을 "이름"으로 지정하세요.')
    return { rows: [], warnings }
  }

  const rows: SecretaryDraft[] = []
  const seen = new Set<string>()
  dataRows.forEach((r) => {
    const name = (r[nameCol] ?? '').trim()
    if (!name || /^(합계|소계|계|이름|성명|담당자)$/.test(name)) return
    const username = userCol >= 0 ? (r[userCol] ?? '').trim() || null : null
    const phone = phoneCol >= 0 ? (r[phoneCol] ?? '').trim() || null : null
    const password = pwCol >= 0 ? (r[pwCol] ?? '').trim() || null : null
    const key = (username ?? `name:${name}`).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ name, username, phone, password })
  })

  if (rows.length === 0) warnings.push('가져올 담당자가 없습니다. 매핑과 "머리글 포함" 설정을 확인하세요.')
  return { rows, warnings }
}
