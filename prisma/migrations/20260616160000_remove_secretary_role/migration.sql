-- 간사(SECRETARY) 역할 제거: 잔여 SECRETARY 사용자 삭제 후 Role enum에서 값 제거
DELETE FROM "User" WHERE "role" = 'SECRETARY';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EVALUATOR');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
