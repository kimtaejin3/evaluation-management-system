# E2E 테스트 계획 · 기능별 동작 명세

검증 계층
- **단위(vitest, `npm test`)**: 순수 로직 — 인증 해시/토큰, 가중 집계·순위, 정성 등급 옵션 파싱, 마감 규칙.
- **통합 시나리오(`npx tsx scripts/e2e-check.ts`)**: 실제 DB(Prisma) + 도메인 헬퍼로 회차 전체 수명주기를 재현·단언. 실행 전후 `E2E*` 데이터 자동 정리.

---

## 1. 인증 · 권한
| ID | 동작해야 하는 것 | 검증 |
|----|----------------|------|
| A1 | 올바른 비밀번호로만 로그인 성공 | `verifyPassword(올바름)=true`, `(틀림)=false` |
| A2 | 토큰에 userId·role 보존 | `verifyToken(signToken(p))` 라운드트립 일치 |
| A3 | 역할 분리(ADMIN/EVALUATOR) | 토큰 role 복원 |

## 2. 회차 수명주기
| ID | 동작 | 검증 |
|----|------|------|
| S1 | 생성 시 기본 상태 = 초안(DRAFT) | 생성 직후 status=DRAFT |
| S2 | 평가 시작 → 진행중(IN_PROGRESS) | 상태 전이 |
| S3 | **마감 규칙**: 평가 일시가 미래면 마감 불가 | `canCloseSession(미래)=false`, `(과거/당일/없음)=true` |
| S4 | 마감 → CLOSED, 이후 입력 잠금 | status=CLOSED |

## 3. 기업 · 자료(전역)
| ID | 동작 | 검증 |
|----|------|------|
| C1 | 기업명 유니크 | 동일 이름 upsert 시 같은 레코드 |
| C2 | 자료는 기업 귀속 → 회차 간 공유 | 같은 기업을 2개 회차에 편입해도 동일 문서 노출 |
| C3 | 한 회차에 같은 기업 중복 편입 불가 | `@@unique(sessionId, companyId)` 위반 시 오류 |
| C4 | 기업 삭제 시 자료·편입 cascade 정리 | 삭제 후 문서·Subject 0건 |

## 4. 평가 항목
| ID | 동작 | 검증 |
|----|------|------|
| K1 | 정량: 0~배점 유효성 | `isValidScoreValue` 경계 |
| K2 | 정성: 등급(답) 옵션 저장, 배점=최고 점수 | `parseGradeOptions` 복원, maxScore=max(points) |
| K3 | 정성 옵션 미지정 → 기본 A~E 폴백 | `defaultGradeOptions(max)` 5단계 |

## 5. 점수 · 집계
| ID | 동작 | 검증 |
|----|------|------|
| G1 | 가중 점수 = Σ(점수×가중치) | `computeWeightedScore` |
| G2 | 최종 = 대상별 위원 평균 | `computeFinalScores` |
| G3 | 순위 내림차순 + 동점 동순위 | `rankSubjects` |
| G4 | 정성 등급 index→점수/라벨 저장 | 옵션[idx].points/label |

## 6. 진행 · 인사이트(모니터링)
| ID | 동작 | 검증 |
|----|------|------|
| P1 | 셀 상태: 전부 입력=완료, 일부=입력중, 없음=미평가 | `getSessionProgress` cell.state |
| P2 | 진행률 = 완료 칸/전체 칸 | pct |
| P3 | 잠정 순위: 완료 위원만 평균, 미완료 대상=집계 전(null) | `getSessionInsights` rows.avg |
| P4 | 위원 간 편차 = 완료 위원 최고-최저(2명+) | rows.spread |

## 7. 종합의견
| ID | 동작 | 검증 |
|----|------|------|
| O1 | 위원×대상 1건(upsert) | `@@unique(evaluatorId, subjectId)` |
