import * as XLSX from 'xlsx'
import { requireAdminUser } from '@/lib/authz'

// 평가항목 가져오기용 빈 양식(.xlsx) 다운로드.
// 첫 행 머리글은 가져오기가 자동 인식하는 '평가항목 / 세부항목 / 평가지표 / 배점'.
// 예시 행 몇 개를 채워 구조(대분류→세부→지표, 배점 합 100)를 보여준다. 사용자는 내용을 바꿔 업로드한다.
export async function GET() {
  await requireAdminUser()

  const header = ['평가항목', '세부항목', '평가지표', '배점']
  const rows = [
    ['사업계획', '목표 및 내용', 'RFP(품목개요서) 부합 정도·기술개발 목표 이해도', 25],
    ['사업계획', '추진 체계', '컨소시엄 구성·역할 분담의 적절성', 15],
    ['추진역량', '연구진 역량', '연구책임자 전문성·참여연구진 역량', 30],
    ['기대효과', '사업화 가능성', '사업화 전략의 우수성·구체성', 20],
    ['기대효과', '파급효과', '고용 창출·경제적 파급효과', 10],
  ]

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 44 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '평가항목')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('평가항목_양식.xlsx')}`,
    },
  })
}
