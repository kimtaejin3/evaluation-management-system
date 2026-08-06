import { assertMaster } from '@/lib/authz'
import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'

// 평가위원 일괄 등록용 빈 양식(.xlsx) — 이름/아이디/연락처/소속/직급.
// 비밀번호는 양식에 없음 — 가져오기 시 연락처 뒷자리로 자동 발급된다.
export async function GET() {
  await assertMaster()
  const buf = await buildStyledSheet({ sheetName: '평가위원', columns: ['이름', '아이디', '연락처', '소속', '직급'] })
  return xlsxResponse(buf, '평가위원_양식.xlsx')
}
