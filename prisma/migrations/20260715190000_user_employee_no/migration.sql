-- 간사 계정용 사번(선택)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeNo" TEXT;
