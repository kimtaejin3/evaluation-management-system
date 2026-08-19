"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReviewStepper, { stepsFromFlags } from "@/components/ReviewStepper";
import { REVIEW_STAGE_LABELS, CHAIR_REVIEW_STAGE_LABELS, chairReviewFlags } from "@/lib/submission";
import {
  saveScores,
  autoSaveScore,
  autoSaveGroupComment,
  pingEditing,
  clearEditing,
} from "@/app/evaluate/actions";
import DocPreviewBoard from "@/components/DocPreviewBoard";
import SubjectPicker from "@/components/SubjectPicker";
import SignaturePad from "@/components/SignaturePad";
import { canEvaluatorEdit } from "@/lib/submission";

// 행 = 채점 단위. 통합(퉁) 배점 세부항목은 행이 1개이고 indicators에 설명용 지표들이 담긴다.
export interface CriterionView {
  id: string;
  groupId: string;
  groupName: string;
  subitemName: string;
  name: string;
  indicators: string[];
  maxScore: number;
  weight: number;
  value: number | null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function ScoreForm({
  sessionId,
  subjectId,
  subjectName,
  sessionName,
  projectName,
  reviewFlags,
  evaluatorName,
  isChair = false,
  eventDate,
  documents,
  criteria,
  initialComment,
  groupComments = {},
  subjects = [],
  submissionStatus = null,
  secretaryReviewed = false,
  masterApproved = false,
  onSelectSubject,
  onDirty,
}: {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  sessionName: string;
  projectName: string | null;
  reviewFlags: boolean[];
  evaluatorName: string;
  isChair?: boolean;
  eventDate: string | null;
  progress: { done: number; total: number };
  documents: { id: string; name: string; mimeType: string }[];
  criteria: CriterionView[];
  initialComment: string;
  // 평가항목(그룹)별 의견 초기값 — groupId → 텍스트
  groupComments?: Record<string, string>;
  subjects?: { id: string; name: string }[];
  otherScores?: Record<string, { name: string; value: number }[]>;
  otherPending?: Record<string, string[]>;
  submissionStatus?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | null;
  secretaryReviewed?: boolean;
  masterApproved?: boolean;
  // CSR 모드 호환(현재 미사용)
  initialStep?: string;
  // CSR 모드: 대상 전환을 라우트 이동 없이 처리
  onSelectSubject?: (id: string, step: string) => void;
  // CSR 모드: 점수 변경 시 호출(클라이언트 캐시 무효화용)
  onDirty?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    saveScores.bind(null, sessionId, subjectId),
    null,
  );
  const [confirm, setConfirm] = useState(false);
  const [comment, setComment] = useState(initialComment);
  // 제출 서명(핸드사인) — 제출 확인 모달에서 매번 새로 그린다
  const [signature, setSignature] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of criteria) o[c.id] = c.value != null ? String(c.value) : "";
    return o;
  });

  // 자동 저장(디바운스)
  const [autoState, setAutoState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runSave = async (criterionId: string, raw: string) => {
    setAutoState("saving");
    try {
      const res = await autoSaveScore(sessionId, subjectId, criterionId, raw);
      setAutoState(res?.ok ? "saved" : "error");
    } catch {
      setAutoState("error");
    }
  };
  const setVal = (id: string, v: string, immediate = false) => {
    setVals((p) => ({ ...p, [id]: v }));
    onDirty?.();
    if (timers.current[id]) clearTimeout(timers.current[id]);
    if (immediate) runSave(id, v);
    else timers.current[id] = setTimeout(() => runSave(id, v), 700);
  };

  // 평가항목(그룹)별 의견 — 점수와 동일한 디바운스 자동 저장
  const [gcVals, setGcVals] = useState<Record<string, string>>(groupComments);
  const runGcSave = async (groupId: string, raw: string) => {
    setAutoState("saving");
    try {
      const res = await autoSaveGroupComment(sessionId, subjectId, groupId, raw);
      setAutoState(res?.ok ? "saved" : "error");
    } catch {
      setAutoState("error");
    }
  };
  const setGcVal = (groupId: string, v: string) => {
    setGcVals((p) => ({ ...p, [groupId]: v }));
    onDirty?.();
    const key = `gc:${groupId}`;
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => runGcSave(groupId, v), 700);
  };

  // 입력 중(포커스) 추적
  const editingId = useRef<string | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const startEditing = (criterionId: string) => {
    editingId.current = criterionId;
    void pingEditing(sessionId, subjectId, criterionId);
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = setInterval(() => {
      if (editingId.current)
        void pingEditing(sessionId, subjectId, editingId.current);
    }, 4000);
  };
  const stopEditing = () => {
    editingId.current = null;
    if (heartbeat.current) {
      clearInterval(heartbeat.current);
      heartbeat.current = null;
    }
    void clearEditing();
  };
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void clearEditing();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (heartbeat.current) clearInterval(heartbeat.current);
      void clearEditing();
    };
  }, []);

  // 값이 0~maxScore 범위인지(빈 값은 범위 판정에서 제외 — isFilled로 별도 처리)
  const isInRange = (c: CriterionView): boolean => {
    const raw = vals[c.id];
    if (raw === "") return true;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= c.maxScore;
  };
  const contrib = (c: CriterionView): number | null => {
    const raw = vals[c.id];
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n * c.weight : null;
  };
  // 입력 완료 판정 — 빈칸만 '미입력'. 0점은 유효 입력(가점/감점 등)으로 인정.
  const isFilled = (c: CriterionView): boolean => {
    const raw = vals[c.id];
    if (raw === "") return false;
    return Number.isFinite(Number(raw));
  };
  const locked = !canEvaluatorEdit(submissionStatus);
  // 제출 완료 여부 — 위원장의 '위원별 평가 · 종합의견' 진입 조건(반려는 재작성 중이라 제외)
  const submitted = submissionStatus === "SUBMITTED" || submissionStatus === "APPROVED";
  const rejected = submissionStatus === "REJECTED";
  // 위원장은 종합의견을 작성해야 제출 가능(항목표에서 종합의견 전 미리 제출하는 것 방지)
  const chairOpinionWritten = initialComment.trim().length > 0;
  const total = criteria.reduce((s, c) => s + (contrib(c) ?? 0), 0);
  const maxTotal = criteria.reduce((s, c) => s + c.maxScore * c.weight, 0);
  const filledCount = criteria.filter((c) => isFilled(c)).length;
  const allFilled = filledCount === criteria.length && criteria.length > 0;
  const allInRange = criteria.every((c) => isInRange(c));
  // 위원장은 전 항목 입력 + 종합의견 작성까지 돼야 제출 가능
  const canSubmit = allFilled && allInRange && (!isChair || chairOpinionWritten);
  // 상단 진행 스텝 — 위원장은 전용 5단계(평가의견→종합의견→제출→담당자→관리자), 일반 위원은 위원장 검토 독립 판정
  const evalSteps = stepsFromFlags(REVIEW_STAGE_LABELS, reviewFlags);
  if (rejected) evalSteps[0] = { ...evalSteps[0], state: "rejected" };
  const reviewSteps = isChair
    ? stepsFromFlags(
        CHAIR_REVIEW_STAGE_LABELS,
        chairReviewFlags({ status: submissionStatus, scored: allFilled, opinionWritten: chairOpinionWritten, secretaryReviewed, masterApproved }),
      )
    : evalSteps;

  // 평가항목(group) → 세부항목(subitem) → 평가지표(criterion). criteria는 이미 group.order→subitem.order→criterion.order로 정렬되어 옴.
  type Grp = {
    id: string;
    no: number;
    name: string;
    subs: { name: string; items: CriterionView[] }[];
  };
  const groups: Grp[] = [];
  criteria.forEach((c) => {
    let g = groups.find((x) => x.id === c.groupId);
    if (!g) {
      g = { id: c.groupId, no: groups.length + 1, name: c.groupName, subs: [] };
      groups.push(g);
    }
    let sg = g.subs.find((x) => x.name === c.subitemName);
    if (!sg) {
      sg = { name: c.subitemName, items: [] };
      g.subs.push(sg);
    }
    sg.items.push(c);
  });

  const deadline = eventDate
    ? new Date(eventDate).toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <form action={formAction}>
      {/* 제출용 히든 값(전 항목 + 서명) */}
      {criteria.map((c) => (
        <input key={c.id} type="hidden" name={`c_${c.id}`} value={vals[c.id]} />
      ))}
      <input type="hidden" name="signature" value={signature ?? ""} />

      {/* 헤더 (현재 너비 유지) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-6 py-2.5">
          {subjects.length > 0 ? (
            <SubjectPicker
              sessionId={sessionId}
              currentId={subjectId}
              subjects={subjects}
              onSelect={
                onSelectSubject ? (id) => onSelectSubject(id, "") : undefined
              }
            />
          ) : (
            <span className="font-semibold text-slate-800">{subjectName}</span>
          )}
          {isChair && (
            <span className="text-xs font-medium text-indigo-700">위원장</span>
          )}
          {deadline && (
            <span className="ml-auto text-xs text-slate-400">
              마감 {deadline}
            </span>
          )}
        </div>
      </div>

      {/* 목록·세션명·자동저장 (현재 너비 유지) */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 pt-4 text-sm">
        <div className="flex items-center gap-2">
          <Link
            href="/evaluate"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50"
          >
            ← 목록
          </Link>
          <span className="text-slate-500">
            {projectName && <span className="text-slate-400">{projectName} · </span>}
            {sessionName}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full ${autoState === "saving" ? "bg-amber-500 animate-pulse" : autoState === "error" ? "bg-rose-500" : autoState === "saved" ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          <span className="text-slate-400">
            {autoState === "saving"
              ? "저장 중"
              : autoState === "error"
                ? "저장 실패"
                : "자동 저장"}
          </span>
        </span>
      </div>

      {/* 진행 단계 스텝퍼 — 작성 → 제출 → 위원장 → 담당자 → 관리자(최종) */}
      <div className="mx-auto mt-3 max-w-[1600px] px-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-5 py-3">
          <ReviewStepper steps={reviewSteps} />
        </div>
        {submissionStatus === "REJECTED" && (
          <p className="mt-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            반려됨 · 점수·의견을 수정한 뒤 다시 제출하세요.
          </p>
        )}
      </div>

      {/* 작업 영역 — 좌:자료 / 우:평가표. 점수·제출은 아래 액션 바로 내려 평가표가 남은 폭을 모두 쓴다 */}
      <div className="mx-auto max-w-[1600px] px-6 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,2.4fr)]">
          {/* 좌: 자료 */}
          <div className="lg:sticky lg:top-14 lg:h-[70vh]">
            <DocPreviewBoard documents={documents} docked />
          </div>

          {/* 중: 평가표(입력) */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                평가표 · {evaluatorName} 위원
              </h2>
              <span className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-slate-500">합계</span>
                <b className="text-2xl text-indigo-700 tabular-nums">{fmt(total)}</b>
                <span className="text-base text-slate-400">/ {fmt(maxTotal)}</span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  {/* 평가항목명이 좁은 열 폭 때문에 줄바꿈되지 않도록 내용 폭에 맞춰 고정 */}
                  <th className="w-px whitespace-nowrap px-3 py-2 font-medium">평가항목</th>
                  <th className="px-3 py-2 font-medium">세부항목</th>
                  <th className="px-3 py-2 font-medium">평가지표</th>
                  <th className="w-px whitespace-nowrap px-3 py-2 text-right font-medium">
                    배점
                  </th>
                  <th className="w-44 px-3 py-2 text-right font-medium">
                    점수
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const groupRowSpan =
                    g.subs.reduce(
                      (n, s) => n + Math.max(1, s.items.length),
                      0,
                    ) || 1;
                  let groupPlaced = false;
                  const itemRows = g.subs.map((sg) => {
                    const subRowSpan = Math.max(1, sg.items.length);
                    return sg.items.map((c, cIdx) => {
                      const outOfRange = !isInRange(c);
                      const cells: React.ReactNode[] = [];
                      if (!groupPlaced) {
                        cells.push(
                          <td
                            key="g"
                            rowSpan={groupRowSpan}
                            className="whitespace-nowrap border-r border-slate-100 px-3 py-3 align-top"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                                {g.no}
                              </span>
                              <span className="font-semibold text-slate-700">
                                {g.name}
                              </span>
                            </span>
                          </td>,
                        );
                        groupPlaced = true;
                      }
                      if (cIdx === 0) {
                        cells.push(
                          <td
                            key="s"
                            rowSpan={subRowSpan}
                            className="border-r border-slate-100 px-3 py-3 align-top text-slate-600"
                          >
                            {sg.name || (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>,
                        );
                      }
                      cells.push(
                        <td key="c" className="px-3 py-2.5 align-top">
                          {c.indicators.length > 0 ? (
                            /* 통합 배점 — 지표들은 설명, 점수는 세부항목당 1개 */
                            <ul className="list-disc space-y-0.5 pl-4 text-slate-700">
                              {c.indicators.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="font-medium text-slate-800">
                              {c.name}
                            </div>
                          )}
                        </td>,
                        <td
                          key="m"
                          className="px-3 py-2.5 text-right align-top tabular-nums text-slate-400"
                        >
                          {c.maxScore}
                        </td>,
                        <td key="v" className="px-3 py-2.5 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="any"
                              min={0}
                              max={c.maxScore}
                              value={vals[c.id]}
                              onChange={(e) => setVal(c.id, e.target.value)}
                              onFocus={() => startEditing(c.id)}
                              onBlur={stopEditing}
                              disabled={locked}
                              placeholder="입력"
                              className={`w-20 rounded-md border px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-1 ${outOfRange ? "border-rose-400 text-rose-600 focus:border-rose-500 focus:ring-rose-500" : "border-slate-300 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"}`}
                            />
                            <span className="text-xs text-slate-400">
                              / {c.maxScore}
                            </span>
                          </div>
                          {outOfRange && (
                            <div className="mt-0.5 text-right text-xs text-rose-500">
                              0~{c.maxScore} 범위로 입력하세요
                            </div>
                          )}
                        </td>,
                      );
                      return (
                        <tr
                          key={c.id}
                          className="border-b border-slate-50 last:border-0"
                        >
                          {cells}
                        </tr>
                      );
                    });
                  });
                  return (
                    <Fragment key={g.id}>
                      {itemRows}
                      {/* 평가항목(그룹)별 의견 — 그룹 블록 아래 전체 폭, 자동 저장 */}
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="px-3 py-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-1.5 shrink-0 text-xs font-medium whitespace-nowrap text-slate-500">
                              {g.name} 의견
                            </span>
                            <textarea
                              value={gcVals[g.id] ?? ""}
                              onChange={(e) => setGcVal(g.id, e.target.value)}
                              disabled={locked}
                              rows={1}
                              maxLength={500}
                              placeholder="이 평가항목에 대한 의견 (선택)"
                              className="min-h-8 w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {criteria.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-slate-400"
                    >
                      평가 항목이 없습니다.
                    </td>
                  </tr>
                )}
                {/* 종합의견 — 평가항목별 의견과 같은 결로 표 맨 아래 전체 폭(제출 시 comment로 저장).
                    위원장도 이 칸에서 바로 종합의견을 쓸 수 있다(대상별 '위원장 종합의견'과 같은 Opinion에 저장). */}
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td colSpan={5} className="px-3 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">평가위원 종합의견</span>
                      <span className="text-xs text-slate-400">{comment.length} / 1000</span>
                    </div>
                    <textarea
                      name="comment"
                      value={comment}
                      maxLength={1000}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={locked}
                      rows={4}
                      placeholder={
                        isChair
                          ? "이 대상에 대한 종합의견을 입력하세요. (제출 전 필수)"
                          : "대상에 대한 종합적인 평가 의견을 입력하세요. (선택)"
                      }
                      className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                    />
                    {isChair && (
                      <p className="mt-1 text-xs text-slate-400">
                        저장 후 ‘위원별 평가 · 종합의견 →’ 화면에서도 이어서 수정·제출할 수 있습니다.
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* 하단: 현재 점수 + 제출/임시 저장 (기존 우측 패널을 아래로 이동) */}
        <div className="mt-4 space-y-3">
          {state?.error && (
            <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {state.error}
            </p>
          )}
          {state?.saved && (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
              임시 저장되었습니다.
            </p>
          )}
          {/* 제출됨/승인 상태는 상단 진행 스텝퍼로 표시(하단 배너 제거) */}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-slate-400">현재 점수</span>
              <span className="text-3xl font-bold text-indigo-700 tabular-nums">
                {fmt(total)}
                <span className="text-base font-normal text-slate-400"> / {fmt(maxTotal)}</span>
              </span>
              <span className="text-xs text-slate-400">
                입력 {filledCount}/{criteria.length}
              </span>
            </div>

            {!locked && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!isChair &&
                  (!allInRange ? (
                    <p className="text-xs text-rose-500">배점을 초과하거나 0 미만인 항목이 있습니다.</p>
                  ) : !allFilled ? (
                    <p className="text-xs text-slate-400">모든 항목 입력 시 제출할 수 있습니다.</p>
                  ) : null)}
                {isChair && (
                  <p className="text-xs text-slate-400">제출은 ‘위원별 평가 · 종합의견’ 화면에서 종합의견 작성 후 진행합니다.</p>
                )}
                <button
                  name="intent"
                  value="save"
                  disabled={!allInRange || isPending}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  임시 저장
                </button>
                {!isChair && (
                  <button
                    type="button"
                    onClick={() => {
                      setSignature(null); // 제출할 때마다 새로 서명
                      setConfirm(true);
                    }}
                    disabled={!canSubmit || isPending}
                    className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {submissionStatus === "REJECTED" ? "재제출 확인 →" : "제출 전 확인 →"}
                  </button>
                )}
              </div>
            )}

            {/* 위원장 전용 — 위원별 평가를 보고 종합의견을 쓴 뒤 제출한다.
                (종합의견 작성 전에도 열어 위원별 평가를 확인·작성할 수 있게 항상 활성) */}
            {isChair && (
              <Link
                href={`/evaluate/${sessionId}/chair/${subjectId}`}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                위원별 평가 · 종합의견 →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 제출 전 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-xs text-slate-400">
              제출 확인 · 제출 후에는 관리자만 재오픈할 수 있습니다
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {subjectName} 평가를 제출할까요?
            </h2>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-500">합계 점수</span>
                <span className="text-2xl font-bold text-indigo-700 tabular-nums">
                  {fmt(total)}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    / {fmt(maxTotal)}
                  </span>
                </span>
              </div>
            </div>

            {/* 제출 서명 — 인쇄 평가표 '(인)' 자리에 표시됩니다 */}
            <div className="mt-4">
              <div className="mb-1.5 text-sm font-medium text-slate-700">
                제출 서명 <span className="text-xs font-normal text-slate-400">— 평가표의 (인) 자리에 들어갑니다</span>
              </div>
              <SignaturePad onChange={setSignature} width={352} height={110} />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                취소 · 수정하기
              </button>
              <button
                name="intent"
                value="submit"
                disabled={isPending || !signature}
                title={signature ? undefined : "서명해야 제출할 수 있습니다"}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "제출 중…" : "평가 제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
