# 심사·평가 관리 시스템

심사 항목 설정 → 평가 → 결과 출력·보관의 큰 흐름을 일반화한 Next.js 풀스택 앱.

- 설계: [docs/superpowers/specs/2026-06-10-evaluation-management-system-design.md](docs/superpowers/specs/2026-06-10-evaluation-management-system-design.md)
- 구현 계획: [docs/superpowers/plans/2026-06-10-evaluation-management-system.md](docs/superpowers/plans/2026-06-10-evaluation-management-system.md)

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Prisma · PostgreSQL · Tailwind CSS · Vitest

## 준비

```bash
# 1. 환경변수
cp .env.example .env   # DATABASE_URL, JWT_SECRET 값 확인/수정

# 2. 의존성
npm install

# 3. DB 마이그레이션 + 초기 관리자 시드
npx prisma migrate dev
npm run db:seed        # admin / admin1234
```

PostgreSQL이 `DATABASE_URL`로 접속 가능해야 합니다.

## 실행

```bash
npm run dev       # http://localhost:3000
npm run build     # 프로덕션 빌드 (타입 체크 포함)
npm test          # 집계·인증 단위 테스트
```

## 역할 · 흐름

- **관리자(admin / admin1234)**: 회차 생성 → 평가 항목(정량/정성·배점·가중치) → 평가 대상 → 평가위원 배정 → `평가 시작` → 진행 → `마감·잠금` → 결과표 조회·CSV·인쇄
- **평가위원**: 관리자가 발급한 계정으로 로그인 → 배정된 진행중 회차의 대상별 점수 입력·제출

## 집계 규칙

- 정량: 0~배점 숫자 직접 입력 / 정성: 등급(A~E) 선택 → 배점 비율 환산(A100·B80·C60·D40·E20%)
- 위원별 대상 점수 = Σ(항목점수 × 가중치), 대상 최종 점수 = 위원 평균, 순위는 최종점수 내림차순(동점 동순위)

## 검증 스크립트

```bash
npx tsx scripts/e2e-check.ts   # 데이터-플로우 E2E (생성→입력→집계→마감)
```
