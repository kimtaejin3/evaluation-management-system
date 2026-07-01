# Task 1 Report: 스키마·마이그레이션 (Project, Session FK, Role)

## What changed

### `prisma/schema.prisma`
- `enum Role` replaced: `ADMIN | EVALUATOR` → `MASTER | SECRETARY | EVALUATOR`.
- New `model Project`:
  ```prisma
  model Project {
    id          String              @id @default(cuid())
    name        String
    description String?
    dueDate     DateTime?
    secretaries User[]              @relation("ProjectSecretaries")
    sessions    EvaluationSession[]
    createdAt   DateTime            @default(now())
  }
  ```
- `model User` gained two back-relations:
  ```prisma
  assignedProjects    Project[]           @relation("ProjectSecretaries")
  secretariedSessions EvaluationSession[] @relation("SessionSecretary")
  ```
- `model EvaluationSession` gained `projectId`/`project` and `secretaryId`/`secretary` fields (both optional FKs, `onDelete: SetNull`).

### `prisma/migrations/20260701170000_project_and_roles/migration.sql` (new)
Verbatim SQL from the plan:
- Renames old `Role` enum, recreates it as `('MASTER', 'SECRETARY', 'EVALUATOR')`, migrates existing `User.role` values with `ADMIN → MASTER` (all other values pass through unchanged), drops the old enum type.
- Creates `Project` table.
- Adds `projectId`/`secretaryId` columns + FKs to `EvaluationSession` (`ON DELETE SET NULL ON UPDATE CASCADE`).
- Creates the implicit m2m join table `_ProjectSecretaries` (A=Project, B=User) with unique/index constraints and cascade FKs.

No other files were modified (confirmed via `git status --porcelain` before commit — only `prisma/schema.prisma` and the new migration folder were staged/committed).

## Migrate deploy output (exact)

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-empty-night-apoudmz1.c-7.us-east-1.aws.neon.tech"

16 migrations found in prisma/migrations

Applying migration `20260701170000_project_and_roles`

The following migration(s) have been applied:

migrations/
  └─ 20260701170000_project_and_roles/
    └─ migration.sql
      
All migrations have been successfully applied.
```

(Pre-existing DB state was confirmed via prior migrations `20260616140000_role_secretary` (added SECRETARY) and `20260616160000_remove_secretary_role` (deleted SECRETARY users, reverted enum to `ADMIN|EVALUATOR`) — so the `Role` enum in the shared dev DB was `ADMIN | EVALUATOR` immediately before this migration, matching the plan's assumption.)

## Prisma generate result

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 67ms
```
(A "major update available 6.19.3 -> 7.8.0" notice was printed; no action taken, out of scope.)

## Build result

```
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"; npm run build
```
Output (relevant lines):
```
✓ Compiled successfully in 1472ms
Failed to type check.
Type error: Type 'import(".../node_modules/.prisma/client/index").$Enums.Role' is not assignable to type 'import(".../lib/auth").Role'.
  Type '"MASTER"' is not assignable to type 'Role'.
```
This matches the expected outcome described in the plan's Step 4 note: webpack **compiles successfully**; the subsequent type-check fails only because other app code still assumes the old `Role` type (`lib/auth.ts` defines `export type Role = 'ADMIN' | 'EVALUATOR'`, independent of the Prisma-generated enum). This is a pre-existing/expected consequence of the schema change and is explicitly deferred to later tasks (Task 2 introduces `lib/authz.ts` with the new `Role` type; Task 3/8 fix remaining call sites).

## Remaining ADMIN references (for later tasks)

`grep -rn "'ADMIN'\|\"ADMIN\"" app lib prisma scripts components | grep -v node_modules`:

```
app/page.tsx:7:  redirect(payload.role === 'ADMIN' ? '/admin/sessions' : '/evaluate')
app/api/sessions/[id]/progress/stream/route.ts:30:  if (!token || token.role !== 'ADMIN') return new Response('Unauthorized', { status: 401 })
app/api/sessions/[id]/results.csv/route.ts:7:  if (!token || token.role !== 'ADMIN') {
app/login/actions.ts:32:  redirect(user.role === 'ADMIN' ? '/admin/sessions' : '/evaluate')
lib/auth.test.ts:14:    const token = await signToken({ userId: 'u1', role: 'ADMIN' })
lib/auth.test.ts:17:    expect(payload?.role).toBe('ADMIN')
lib/login-rules.test.ts:15:    expect(evaluatorLoginError('ADMIN', 0)).toBeNull()
lib/auth.ts:4:export type Role = 'ADMIN' | 'EVALUATOR'
prisma/seed.ts:11:    create: { username: 'admin', passwordHash, name: '관리자', role: 'ADMIN' },
prisma/migrations/20260701170000_project_and_roles/migration.sql:5:  (CASE "role"::text WHEN 'ADMIN' THEN 'MASTER' ELSE "role"::text END)::"Role"
prisma/migrations/20260616160000_remove_secretary_role/migration.sql:5:CREATE TYPE "Role" AS ENUM ('ADMIN', 'EVALUATOR');
prisma/migrations/20260610085931_init/migration.sql:2:CREATE TYPE "Role" AS ENUM ('ADMIN', 'EVALUATOR');
scripts/shots.ts:12:  const adminTok = await signToken({ userId: admin!.id, role: 'ADMIN' })
scripts/e2e-check.ts:182:  assert(evaluatorLoginError('ADMIN', 0) === null, 'L5 관리자는 진행중 심사 없어도 허용')
```

Notes:
- `prisma/migrations/**/migration.sql` hits are historical/immutable migration files — not to be edited, listed only because the grep matched them.
- `lib/auth.ts:4` is the root cause of the build type error — its local `Role` type needs to change to include `MASTER`/`SECRETARY` (or be superseded by `lib/authz.ts`'s `Role` type, per Task 2).
- The other app/lib/scripts hits (`app/page.tsx`, `app/api/sessions/[id]/progress/stream/route.ts`, `app/api/sessions/[id]/results.csv/route.ts`, `app/login/actions.ts`, `lib/auth.test.ts`, `lib/login-rules.test.ts`, `prisma/seed.ts`, `scripts/shots.ts`, `scripts/e2e-check.ts`) need `ADMIN` → `MASTER` (and in some cases `MASTER`/`SECRETARY` both) treatment in later tasks (Task 3, Task 8 per the plan).
- Not fixed here per instructions — left for later tasks.

## Commit

```
git add prisma/schema.prisma prisma/migrations/20260701170000_project_and_roles
git commit -m "feat(schema): Project 도입 + 분과 project/secretary + Role(MASTER/SECRETARY/EVALUATOR)"
```

Commit hash: `920d884`

```
[main 920d884] feat(schema): Project 도입 + 분과 project/secretary + Role(MASTER/SECRETARY/EVALUATOR)
 2 files changed, 57 insertions(+), 1 deletion(-)
 create mode 100644 prisma/migrations/20260701170000_project_and_roles/migration.sql
```

Not pushed, per instructions.
