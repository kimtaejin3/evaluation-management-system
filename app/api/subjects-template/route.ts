import * as XLSX from 'xlsx'
import { requireAdminUser } from '@/lib/authz'

// 평가 대상 가져오기용 빈 양식(.xlsx) 다운로드.
// 첫 행 머리글(기업명 / 사업자번호 / 지역 / 연구책임자)만 담고 셀 데이터는 비운다.
// 머리글은 가져오기가 자동 인식하는 이름. 담당자가 아래에 내용을 채워 업로드한다.
export async function GET() {
  await requireAdminUser()

  const header = ['기업명', '사업자번호', '지역', '연구책임자']

  const ws = XLSX.utils.aoa_to_sheet([header])
  ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '평가대상')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가대상_양식.xlsx')}`,
    },
  })
}
