import { requireAdminUser } from '@/lib/authz'
import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'

// 평가항목 가져오기용 빈 양식(.xlsx) — 머리글(평가항목/세부항목/평가지표/배점)만, 셀 데이터 없음.
// 헤더 회색 배경·가운데 정렬(내보내기와 동일 스타일).
export async function GET() {
  await requireAdminUser()
  const buf = await buildStyledSheet({ sheetName: '평가항목', columns: ['평가항목', '세부항목', '평가지표', '배점'] })
  return xlsxResponse(buf, '평가항목_양식.xlsx')
}
