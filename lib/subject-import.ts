// 평가 대상(기업) 명단 엑셀 임포트 — 순수 파싱/매핑(서버·클라 공용).
// 격자(string[][])는 parseTsv(붙여넣기)/parseSheet(파일)로 얻는다. 여기선 매핑 적용·검증만.

export type SubjectField = 'name' | 'businessNo' | 'description'

export interface SubjectFieldDef {
  field: SubjectField
  label: string
  required: boolean
}

export const SUBJECT_FIELDS: SubjectFieldDef[] = [
  { field: 'name', label: '기업명(평가 대상)', required: true },
  { field: 'businessNo', label: '사업자번호', required: false },
  { field: 'description', label: '설명', required: false },
]

const SYNONYMS: Record<SubjectField, string[]> = {
  name: ['기업명', '업체명', '회사명', '상호명', '상호', '대상명', '평가대상명', '평가대상', '과제명', '사업명', '기관명', '명칭', '기업', '업체', '회사'],
  businessNo: ['사업자등록번호', '사업자번호', '사업자', '등록번호', 'businessno', 'bizno'],
  description: ['설명', '사업개요', '과제개요', '개요', '비고', '내용'],
}

function norm(s: string): string {
  return s
    .replace(/[([{][^)\]}]*[)\]}]/g, '')
    .replace(/[\s()[\]{}·.\-_/]/g, '')
    .trim()
    .toLowerCase()
}

export type SubjectColumnMapping = (SubjectField | null)[]

// 정확 일치 → 부분 포함 2단계(너그러운 매칭). 다른 임포트들과 동일 정책.
export function autoDetectSubjectMapping(headers: string[]): SubjectColumnMapping {
  const result: SubjectColumnMapping = headers.map(() => null)
  const used = new Set<SubjectField>()
  const keys = headers.map(norm)
  const tryAssign = (mode: 'exact' | 'loose') => {
    headers.forEach((_, i) => {
      if (result[i] !== null) return
      const key = keys[i]
      if (!key) return
      for (const def of SUBJECT_FIELDS) {
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

export function subjectLooksLikeHeader(firstRow: string[]): boolean {
  return autoDetectSubjectMapping(firstRow).some((f) => f !== null)
}

export interface SubjectDraft {
  name: string
  businessNo: string | null
  description: string | null
}

export interface SubjectBuildResult {
  rows: SubjectDraft[]
  warnings: string[]
}

export function buildSubjects(
  grid: string[][],
  mapping: SubjectColumnMapping,
  opts: { hasHeader: boolean },
): SubjectBuildResult {
  const warnings: string[] = []
  const dataRows = opts.hasHeader ? grid.slice(1) : grid
  const nameCol = mapping.findIndex((f) => f === 'name')
  const bizCol = mapping.findIndex((f) => f === 'businessNo')
  const descCol = mapping.findIndex((f) => f === 'description')

  if (nameCol < 0) {
    warnings.push('필수 필드 "기업명"이 어느 열에도 매핑되지 않았습니다. 한 열을 "기업명"으로 지정하세요.')
    return { rows: [], warnings }
  }

  const rows: SubjectDraft[] = []
  const seen = new Set<string>()
  dataRows.forEach((r) => {
    const name = (r[nameCol] ?? '').trim()
    if (!name || /^(합계|소계|계|기업명|업체명|회사명)$/.test(name)) return
    const key = name.toLowerCase()
    if (seen.has(key)) return // 같은 입력 내 중복 기업 제거
    seen.add(key)
    const businessNo = bizCol >= 0 ? (r[bizCol] ?? '').trim() || null : null
    const description = descCol >= 0 ? (r[descCol] ?? '').trim() || null : null
    rows.push({ name, businessNo, description })
  })

  if (rows.length === 0) warnings.push('가져올 평가 대상이 없습니다. 매핑과 "헤더 포함" 설정을 확인하세요.')
  return { rows, warnings }
}
