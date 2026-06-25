"use client";

/* eslint-disable react-hooks/refs -- 디바운스 타이머·입력중 heartbeat용 ref는 이벤트 핸들러/이펙트에서만 접근(렌더 중 접근 아님). 규칙이 ref를 닫는 핸들러를 과하게 잡는 false-positive */

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  saveScores,
  autoSaveScore,
  pingEditing,
  clearEditing,
} from "@/app/evaluate/actions";
import type { GradeOption } from "@/lib/scoring";
import DocPreviewBoard from "@/components/DocPreviewBoard";
import SubjectPicker from "@/components/SubjectPicker";

export interface CriterionView {
  id: string;
  section: string | null;
  name: string;
  description: string | null;
  type: "QUANTITATIVE" | "QUALITATIVE";
  maxScore: number;
  weight: number;
  value: number | null;
  options: GradeOption[] | null;
  selectedIndex: number | null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const QUICK = [
  "전략 명확함",
  "리스크 우려",
  "조직 안정",
  "실적 우수",
  "보완 필요",
];

export default function ScoreForm({
  sessionId,
  subjectId,
  subjectName,
  sessionName,
  evaluatorName,
  isChair = false,
  eventDate,
  documents,
  criteria,
  initialComment,
  subjects = [],
  otherScores = {},
  onSelectSubject,
  onDirty,
}: {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  sessionName: string;
  evaluatorName: string;
  isChair?: boolean;
  eventDate: string | null;
  progress: { done: number; total: number };
  documents: { id: string; name: string; mimeType: string }[];
  criteria: CriterionView[];
  initialComment: string;
  subjects?: { id: string; name: string }[];
  otherScores?: Record<string, { name: string; value: number }[]>;
  otherPending?: Record<string, string[]>;
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
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of criteria)
      o[c.id] =
        c.type === "QUALITATIVE"
          ? c.selectedIndex != null
            ? String(c.selectedIndex)
            : ""
          : c.value != null
            ? String(c.value)
            : "";
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

  const contrib = (c: CriterionView): number | null => {
    const raw = vals[c.id];
    if (raw === "") return null;
    if (c.type === "QUALITATIVE") {
      const opt = c.options?.[Number(raw)];
      return opt ? opt.points * c.weight : null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n * c.weight : null;
  };
  // 입력 완료 판정 — 빈칸만 '미입력'. 0점은 유효 입력(가점/감점 등)으로 인정. 정성은 선택(인덱스 0 포함) 인정
  const isFilled = (c: CriterionView): boolean => {
    const raw = vals[c.id];
    if (raw === "") return false;
    if (c.type === "QUANTITATIVE") return Number.isFinite(Number(raw));
    return true;
  };
  const total = criteria.reduce((s, c) => s + (contrib(c) ?? 0), 0);
  const maxTotal = criteria.reduce((s, c) => s + c.maxScore * c.weight, 0);
  const filledCount = criteria.filter((c) => isFilled(c)).length;
  const allFilled = filledCount === criteria.length && criteria.length > 0;

  // 항목(섹션)별 그룹 + 번호 체계(1 / 1-1) — 미분류는 맨 끝
  type Item = { c: CriterionView; code: string };
  const sections: { no: number; name: string | null; items: Item[] }[] = [];
  criteria.forEach((c) => {
    const key = c.section || null;
    let g = sections.find((x) => x.name === key);
    if (!g) {
      g = { no: 0, name: key, items: [] };
      sections.push(g);
    }
    g.items.push({ c, code: "" });
  });
  sections.sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : 0));
  sections.forEach((g, gi) => {
    g.no = gi + 1;
    g.items.forEach((it, ii) => {
      it.code = `${g.no}-${ii + 1}`;
    });
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
      {/* 제출용 히든 값(전 항목) */}
      {criteria.map((c) => (
        <input key={c.id} type="hidden" name={`c_${c.id}`} value={vals[c.id]} />
      ))}

      {/* 헤더 (현재 너비 유지) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-6 py-2.5">
          {subjects.length > 0 ? (
            <SubjectPicker
              sessionId={sessionId}
              currentId={subjectId}
              subjects={subjects}
              onSelect={onSelectSubject ? (id) => onSelectSubject(id, "") : undefined}
            />
          ) : (
            <span className="font-semibold text-slate-800">{subjectName}</span>
          )}
          {isChair && (
            <>
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                위원장
              </span>
              <Link
                href={`/evaluate/${sessionId}/chair`}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                다른 위원 평가 · 총평 →
              </Link>
            </>
          )}
          {deadline && (
            <span className="ml-auto text-xs text-slate-400">마감 {deadline}</span>
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
          <span className="text-slate-500">{sessionName}</span>
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

      {/* 작업 영역 — 좌:자료 / 중:평가표 / 우:종합의견 (넓게) */}
      <div className="mx-auto max-w-[1600px] px-6 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,1.75fr)_320px]">
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
              <span className="text-sm">
                합계 <b className="text-indigo-700 tabular-nums">{fmt(total)}</b>{" "}
                <span className="text-slate-400">/ {fmt(maxTotal)}</span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-px whitespace-nowrap px-3 py-2 text-center font-medium">번호</th>
                  <th className="px-3 py-2 font-medium">평가 항목</th>
                  <th className="w-px whitespace-nowrap px-3 py-2 text-right font-medium">배점</th>
                  <th className="w-44 px-3 py-2 text-right font-medium">점수</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((g) => (
                  <Fragment key={g.no}>
                    <tr>
                      <td colSpan={4} className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{g.no}</span>
                        <span className="ml-1.5 text-xs font-semibold text-slate-600">{g.name ?? "미분류"}</span>
                      </td>
                    </tr>
                    {g.items.map((it) => {
                      const c = it.c;
                      const others = otherScores[c.id] ?? [];
                      return (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2.5 text-center align-top tabular-nums text-indigo-600">{it.code}</td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-medium text-slate-800">{c.name}</div>
                            {c.description && (
                              <div className="mt-0.5 text-xs leading-snug text-slate-400">{c.description}</div>
                            )}
                            {others.length > 0 && (
                              <div className="mt-1 truncate text-[11px] text-slate-400">
                                다른 대상: {others.map((o) => `${o.name} ${fmt(o.value)}`).join(" · ")}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right align-top tabular-nums text-slate-400">{c.maxScore}</td>
                          <td className="px-3 py-2.5 align-top">
                            {c.type === "QUALITATIVE" ? (
                              <select
                                value={vals[c.id]}
                                onChange={(e) => setVal(c.id, e.target.value, true)}
                                onFocus={() => startEditing(c.id)}
                                onBlur={stopEditing}
                                className={`w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${vals[c.id] === "" ? "text-slate-400" : "text-slate-800"}`}
                              >
                                <option value="">선택</option>
                                {(c.options ?? []).map((o, idx) => (
                                  <option key={idx} value={idx}>
                                    {o.label} · {o.points}점
                                  </option>
                                ))}
                              </select>
                            ) : (
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
                                  placeholder="입력"
                                  className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-slate-400">/ {c.maxScore}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                {criteria.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-slate-400">평가 항목이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 우: 종합의견 + 제출 */}
          <div className="space-y-4 lg:sticky lg:top-14 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-center">
                <div className="text-xs text-slate-400">현재 점수</div>
                <div className="text-3xl font-bold text-indigo-700 tabular-nums">
                  {fmt(total)}
                  <span className="text-base font-normal text-slate-400"> / {fmt(maxTotal)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">입력 {filledCount}/{criteria.length}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">종합의견</span>
                <span className="text-xs text-slate-400">{comment.length} / 1000</span>
              </div>
              <textarea
                name="comment"
                value={comment}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
                rows={8}
                placeholder="대상에 대한 종합적인 평가 의견을 입력하세요. (선택)"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setComment((c) => (c ? `${c} ${q}` : q))}
                    className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>
            )}
            {state?.saved && (
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">임시 저장되었습니다.</p>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setConfirm(true)}
                disabled={!allFilled || isPending}
                className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                제출 전 확인 →
              </button>
              <button
                name="intent"
                value="save"
                disabled={isPending}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                임시 저장
              </button>
              {!allFilled && (
                <p className="text-center text-xs text-slate-400">모든 항목 입력 시 제출할 수 있습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 제출 전 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-xs text-slate-400">제출 확인 · 제출 후에는 관리자만 재오픈할 수 있습니다</div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{subjectName} 평가를 제출할까요?</h2>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-500">합계 점수</span>
                <span className="text-2xl font-bold text-indigo-700 tabular-nums">
                  {fmt(total)} <span className="text-sm font-normal text-slate-400">/ {fmt(maxTotal)}</span>
                </span>
              </div>
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
                disabled={isPending}
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
