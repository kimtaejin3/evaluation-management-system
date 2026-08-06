import { assertMaster } from '@/lib/authz'
import { buildStyledSheet, xlsxResponse } from '@/lib/xlsx-style'

// 담당자 일괄 등록용 빈 양식(.xlsx) — 담당자 관리 테이블에 맞춘 머리글(이름/아이디/비밀번호/연락처)만.
export async function GET() {
  await assertMaster()
  const buf = await buildStyledSheet({ sheetName: '담당자', columns: ['이름', '아이디', '비밀번호', '연락처'] })
  return xlsxResponse(buf, '담당자_양식.xlsx')
}
