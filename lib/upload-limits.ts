// 업로드 용량 한도 — 클라이언트(폼)·서버(presign 검증) 공용.
// R2 직접 업로드(브라우저→R2)는 서버를 거치지 않으므로 Vercel 본문 한도(~4.5MB)와 무관.
export const MAX_UPLOAD_MB = 100
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

// R2 미설정 환경(서버 액션 폴백) 한도 — next.config의 serverActions.bodySizeLimit(4mb)와 맞춘다.
export const FALLBACK_MAX_MB = 4
export const FALLBACK_MAX_BYTES = FALLBACK_MAX_MB * 1024 * 1024
