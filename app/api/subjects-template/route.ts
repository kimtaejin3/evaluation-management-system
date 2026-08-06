import { requireAdminUser } from '@/lib/authz'
import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'

// 평가 대상 가져오기용 빈 양식(.xlsx) — 머리글(기업명/사업자번호/지역/연구책임자)만.
export async function GET() {
  await requireAdminUser()
  const buf = await buildStyledSheet({ sheetName: '평가대상', columns: ['기업명', '사업자번호', '지역', '연구책임자'] })
  return xlsxResponse(buf, '평가대상_양식.xlsx')
}
