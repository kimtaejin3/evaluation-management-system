-- 인쇄 평가표 헤더 필드 재배치(2차):
--   지역·연구책임자 → Company, 과제유형 → Project. 과제명은 Project.name 사용.
--   Subject의 헤더 입력 컬럼(taskName/region/taskType/leadResearcher) 제거.
-- 이전 시도의 잔여 컬럼이 있을 수 있어 IF EXISTS / IF NOT EXISTS로 멱등하게 처리.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadResearcher" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "taskType" TEXT;
-- 지역은 이제 기업(Company) 단위 → Project.region 제거(과거 잔여 컬럼)
ALTER TABLE "Project" DROP COLUMN IF EXISTS "region";

ALTER TABLE "Subject" DROP COLUMN IF EXISTS "taskName";
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "region";
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "taskType";
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "leadResearcher";
