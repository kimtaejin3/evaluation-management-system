# 사내 k8s(라인월드 103) 배포 런북

Vercel 배포는 그대로 유지하고, 사내 쿠버네티스에 **독립 데이터(클러스터 내 Postgres)** 로
병행 배포한다. 공통 인프라·접속법은 Obsidian [라인월드 운영 서버 현황] 참고.

- 배포 방식: **KIOPS Cloud(구 KIWI)** — repo 의 `k8s/` 매니페스트를 읽어 image 태그만
  빌드 버전으로 교체해 배포. Jenkins SSH 경로를 타지 않는다.
- 구성: `k8s/db.yaml`(Postgres StatefulSet) + `k8s/app.yaml`(Next.js standalone) +
  `k8s/ingress.yaml`(`eval.mipllab.com`)
- DB: 클러스터 내 `ems-db`(Vercel 의 Neon 과 **완전 분리** — 데이터가 서로 다름)
- 파일 저장: R2 공유(Vercel 과 동일 버킷) — PVC 불필요

## 0. 사전 확인 (103 에서)

```bash
# 게이트웨이 → 마스터
ssh lw@210.217.121.39 -p 5022
ssh tomcat@192.168.0.103

kubectl get sc                    # 기본 StorageClass 있는지 — 없으면 db.yaml 에 이름 명시
kubectl get ns ems                # 네임스페이스 (KIOPS 가 만들어 주지 않으면 create)
```

- R2 egress: 워커 노드에서 외부 https 나가는지 (`curl -sI https://cloudflare.com` 정도)
- `eval.mipllab.com` 이 38번 리버스 프록시를 통과하는지 (와일드카드 vs server 블록 추가)

## 1. Secret 생성 (최초 1회, 첫 빌드 **전에**)

Secret 객체가 없으면 pod 가 `CreateContainerConfigError` 로 멈춘다.
값에 특수문자가 있으니 **작은따옴표 필수**.

```bash
kubectl create ns ems   # 없다면

kubectl -n ems create secret generic ems-db-secret \
  --from-literal=POSTGRES_USER=ems \
  --from-literal=POSTGRES_PASSWORD='<강한 비밀번호>' \
  --from-literal=POSTGRES_DB=ems

kubectl -n ems create secret generic ems-secrets \
  --from-literal=DATABASE_URL='postgresql://ems:<위와 같은 비밀번호>@ems-db:5432/ems' \
  --from-literal=JWT_SECRET='<임의의 긴 문자열 — Vercel 값과 달라도 무방>' \
  --from-literal=R2_ACCOUNT_ID='...' \
  --from-literal=R2_ACCESS_KEY_ID='...' \
  --from-literal=R2_SECRET_ACCESS_KEY='...' \
  --from-literal=R2_BUCKET='...'
```

확인: `kubectl -n ems get secret ems-db-secret ems-secrets` — 둘 다 나와야 다음 진행.

## 2. GitLab push + KIOPS 등록

```bash
git remote add gitlab <사내 GitLab(볼륨서버 100) 저장소 URL>
git push gitlab main
```

KIOPS Cloud 에 프로젝트 등록 → 빌드(레포의 `Dockerfile` 사용) → 배포(`k8s/` 적용).
등록 후 **이미지 경로와 pull secret 이름을 실제 생성된 값으로 `k8s/app.yaml` 에 반영**할 것
(현재 placeholder: `harbor.mipllab.com/ems/service` / `ems-registry-cred`).

> ⚠️ 마스터 홈에서 `kubectl apply -f k8s/app.yaml` 을 직접 돌리지 말 것 —
> 동명 yaml 오적용 사고 전례(2026-07-23). 배포는 push→KIOPS 로만.

## 3. 배포 순서

1. **db.yaml 이 먼저 떠야 한다** — 앱의 initContainer(`prisma migrate deploy`)가 DB 를 기다린다.
   (KIOPS 가 `k8s/` 전체를 한 번에 적용해도 initContainer 재시도로 수렴하니 무방)
2. 앱 pod Running 확인:
   ```bash
   kubectl -n ems get pods            # ems-db-0 Running → ems-xxxx Running
   kubectl -n ems logs deploy/ems -c migrate   # 마이그레이션 로그
   ```

## 4. 초기 계정 (최초 1회)

시연용 전체 시드(`prisma/seed.ts`)는 tsx(devDependency)가 필요해 이미지에 없다.
**관리자 계정만** pod 안에서 직접 만든다 (standalone 에 @prisma/client·bcryptjs 포함):

```bash
kubectl -n ems exec deploy/ems -- node -e '
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
(async () => {
  const p = new PrismaClient();
  const passwordHash = await bcrypt.hash("admin1234", 10);
  await p.user.upsert({
    where: { username: "admin" },
    update: { role: "MASTER", name: "관리자" },
    create: { username: "admin", passwordHash, name: "관리자", role: "MASTER" },
  });
  console.log("admin ok");
  await p.$disconnect();
})();'
```

전체 데모 시드가 필요하면: 103 에서 `kubectl -n ems port-forward --address 0.0.0.0 svc/ems-db 15432:5432`
→ 로컬에서 `ssh -L 15432:192.168.0.103:15432 -p 5022 lw@210.217.121.39` 터널
→ `DATABASE_URL='postgresql://ems:<pw>@localhost:15432/ems' npm run db:seed`

## 5. 검증

- `https://eval.mipllab.com/login` → admin 로그인
- 파일 업로드 1건 → R2 로 저장되는지 (`lib/storage.ts` 는 R2 설정 시 R2 우선)
- 재배포 후 `kubectl -n ems get pods` 로 **새 pod 가 Running 인지** 확인
  ("job 이 돌았다 ≠ 성공" — 빌드 실패 시 옛 pod 가 계속 돈다)
- Vercel 프로덕션 교차 확인 — **데이터가 다르게 보이는 것이 정상**(DB 분리)

## 주의 (사고 전례)

- `tomcat` 홈 파일을 `sudo` 로 편집하지 말 것 — authorized_keys 소실 사고(2026-08-07)
- DB 이미지 태그 고정 유지(`postgres:16.9-alpine`) — 무태그 latest 로 재생성하면
  메이저 점프 + 다운그레이드 불가
- `kubectl set env` 는 임시 시험용 — 다음 배포에서 git(`k8s/app.yaml`)이 이긴다.
  Secret 은 클러스터가 원천이라 영구히 남는다.
