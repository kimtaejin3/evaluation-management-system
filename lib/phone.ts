// 연락처 관련 순수 유틸(서버·클라 공용). 계정 임시 비밀번호는 연락처 끝 4자리로 발급한다.

// 숫자만 남긴다. ('010-1234-5678' → '01012345678')
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

// 연락처 끝 4자리(숫자)를 임시 비밀번호로. 숫자가 4자리 미만이면 null(발급 불가).
export function passwordFromPhone(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone)
  return d.length >= 4 ? d.slice(-4) : null
}
