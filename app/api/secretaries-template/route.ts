import * as XLSX from 'xlsx'
import { assertMaster } from '@/lib/authz'

// 담당자 일괄 등록용 빈 양식(.xlsx) — 현재 담당자 관리 테이블에 맞춘 머리글(이름/아이디/비밀번호/연락처)만.
// 셀 데이터는 비운다. 비밀번호를 비우면 가져오기 시 연락처 끝 4자리로 자동 발급된다.
export async function GET() {
  await assertMaster()

  const header = ['이름', '아이디', '비밀번호', '연락처']

  const ws = XLSX.utils.aoa_to_sheet([header])
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '담당자')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('담당자_양식.xlsx')}`,
    },
  })
}
