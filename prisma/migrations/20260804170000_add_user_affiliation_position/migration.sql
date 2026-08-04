-- 평가위원 소속/직급 표시용 컬럼(추가, nullable). 공유 DB에 raw SQL로 선적용됨.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliation" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" TEXT;
