// 평가표 템플릿 — 심사 항목(대제목=section)·세부항목(Criterion)·등급(답) 정의.
// 모든 항목은 정성(QUALITATIVE)이며 등급별 환산점수를 가짐.

// JSON 컬럼(gradeOptions)에 그대로 저장되므로 interface가 아닌 type 별칭 사용(Prisma InputJsonValue 호환)
export type TemplateGrade = {
  label: string
  points: number
}
export interface TemplateItem {
  name: string
  description?: string
  grades: TemplateGrade[]
}
export interface TemplateSection {
  section: string
  items: TemplateItem[]
}
export interface CriteriaTemplate {
  key: string
  name: string
  total: number
  sections: TemplateSection[]
}

// 5등급(탁월/우수/보통/미흡/불량) 환산: 배점 기준 max → max·4/5·3/5·2/5·1/5
const G5 = ['탁월', '우수', '보통', '미흡', '불량']
const scale = (max: number): TemplateGrade[] =>
  G5.map((label, i) => ({ label, points: Math.round((max * (5 - i)) / 5) }))

// 지역특화 R&D 평가표 (합계 100점)
const REGIONAL_RND: CriteriaTemplate = {
  key: 'regional-rnd',
  name: '지역특화 R&D 평가표 (100점)',
  total: 100,
  sections: [
    {
      section: '기술성',
      items: [
        { name: '기술개발 방향의 적정성', grades: scale(5) },
        { name: '기술개발 접근 방법의 적정성', grades: scale(15) },
        { name: '기술개발 결과의 기술적 활용 가능성', grades: scale(5) },
      ],
    },
    {
      section: '사업성',
      items: [
        { name: '사업화 계획의 가능성', grades: scale(10) },
        { name: '기술개발 결과의 사업적 활용 가능성', grades: scale(5) },
      ],
    },
    {
      section: '기술개발 보유 역량 수준',
      items: [
        { name: '선행연구의 우수성과 적정성', grades: scale(10) },
        { name: '연구개발역량', grades: scale(15) },
        { name: '연구윤리', grades: scale(10) },
      ],
    },
    {
      section: '지역특화',
      items: [
        {
          name: '지역정책 부합성',
          description:
            '지역현안 관련 과제이거나 신속한 지원이 필요한지 여부 판단. (대전) 바이오·반도체, (세종) 자동차·바이오. ※ 제출서류: 별첨서식(지역특화 지표 검토 신청서)',
          grades: scale(5),
        },
        {
          name: '특화분야 적합성',
          description:
            '지역 특화 분야와 기술개발 아이템 간의 적합성 판단. (대전) 반도체·바이오, (세종) 미래소재·자동차·바이오. ※ 제출서류: 별첨서식(지역특화 지표 검토 신청서)',
          grades: scale(5),
        },
        {
          name: '개방형 혁신',
          description:
            '기술개발이 다양한 분야에 활용 가능한지, 기술간 융합·신시장 창출 가능성 등을 판단. ※ 제출서류: 별첨서식(지역특화 지표 검토 신청서)',
          grades: scale(5),
        },
        {
          name: '연구 인프라 보유',
          description:
            '기업부설연구소(5점) 또는 연구개발전담부서(3점) 보유 여부 판단(미보유 1점). ※ 제출서류: 기업부설연구소(연구개발전담부서) 인정서 — (사)한국산업기술진흥협회 발행, 공고일 기준 최근 3개월 이내 발급본',
          grades: [
            { label: '기업부설연구소', points: 5 },
            { label: '연구개발전담부서', points: 3 },
            { label: '미보유', points: 1 },
          ],
        },
      ],
    },
    {
      section: '자금집행계획',
      items: [{ name: '자금집행계획', grades: scale(5) }],
    },
  ],
}

export const CRITERIA_TEMPLATES: CriteriaTemplate[] = [REGIONAL_RND]

export function getCriteriaTemplate(key: string): CriteriaTemplate | undefined {
  return CRITERIA_TEMPLATES.find((t) => t.key === key)
}
