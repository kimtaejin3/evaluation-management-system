'use client'

import type { ReactNode } from 'react'

// 인쇄 문서를 '새 탭(최상위 문서)'으로 열어 인쇄한다.
// 이유: iframe(하위 프레임)을 contentWindow.print()로 인쇄하면 브라우저가 그 프레임의 CSS를
// 제대로 적용하지 못해(특히 Next 동적 CSS + Tailwind) 스타일이 누락된다. 최상위 문서로 인쇄하면
// 화면과 동일한 스타일로 나온다. 새 탭의 AutoPrint가 인쇄 대화상자를 띄우며, 취소해도 그 탭의
// [인쇄] 버튼으로 다시 인쇄/확인할 수 있다. window.open은 클릭 제스처 안에서 호출돼 팝업 차단 없음.
export function usePrintPreview() {
  const print = (url: string) => {
    window.open(url, 'evms_print') // 고정 이름으로 같은 탭 재사용(탭 누적 방지)
  }
  return { print, element: null as ReactNode }
}
