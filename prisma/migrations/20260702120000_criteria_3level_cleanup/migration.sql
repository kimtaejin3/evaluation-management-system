ALTER TABLE "Criterion" ALTER COLUMN "subitemId" SET NOT NULL;
ALTER TABLE "Criterion" DROP COLUMN "section";
ALTER TABLE "Criterion" DROP COLUMN "description";
ALTER TABLE "Criterion" DROP COLUMN "type";
ALTER TABLE "Criterion" DROP COLUMN "gradeOptions";
DROP TABLE "CriterionTemplateItem";
DROP TABLE "CriterionTemplate";
DROP TYPE "CriterionType";
