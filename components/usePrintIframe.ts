'use client'

import { useState } from 'react'

// 페이지 이동 없이 숨김 iframe에 인쇄용 문서를 로드해 그 문서만 바로 인쇄한다.
// 로드가 끝나 인쇄 대화상자가 뜰 때까지 preparing=true (호출측에서 "인쇄 준비 중…" 표시).
export function usePrintIframe() {
  const [preparing, setPreparing] = useState(false)

  const print = (url: string) => {
    setPreparing(true)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.onload = () => {
      const w = iframe.contentWindow
      if (!w) {
        setPreparing(false)
        return
      }
      const done = () => iframe.remove()
      w.addEventListener('afterprint', done, { once: true })
      setPreparing(false) // 로드 완료 → 대화상자 표시
      w.focus()
      w.print()
      // afterprint 미발생(취소/미지원) 대비 폴백 정리
      setTimeout(done, 60_000)
    }
    iframe.onerror = () => {
      setPreparing(false)
      iframe.remove()
    }
    iframe.src = url
    document.body.appendChild(iframe)
  }

  return { preparing, print }
}
