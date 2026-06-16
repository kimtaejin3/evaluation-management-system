-- 간사(SECRETARY) 계정 시드 — 이미 있으면 역할만 갱신
INSERT INTO "User" ("id", "username", "passwordHash", "name", "role")
VALUES ('usr_gansa_secretary0000', 'gansa', '$2b$10$o7954Pc2t/QxmC.8RHswK..gzqfKluMbEKsZwW2KMAxa6aCxjTn6.', '간사', 'SECRETARY')
ON CONFLICT ("username") DO UPDATE SET "role" = 'SECRETARY';
