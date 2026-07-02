"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGroup,
  updateGroup,
  deleteGroup,
  addSubitem,
  updateSubitem,
  deleteSubitem,
  addCriterion,
  updateCriterion,
  deleteCriterion,
} from "@/app/admin/sessions/actions";
import { groupTotal, isGroupBalanced } from "@/lib/criteria";
import { TrashIcon, PencilIcon } from "@/components/icons";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";

const inputCls =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const miniBtn =
  "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50";
const okBtn =
  "rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40";

type LeafDTO = { id: string; name: string; maxScore: number };
type SubitemDTO = { id: string; name: string; criteria: LeafDTO[] };
type GroupDTO = { id: string; name: string; maxScore: number; subitems: SubitemDTO[] };

type RunFn = (fn: () => Promise<void>) => void;

const COL_COUNT = 7;

export default function CriteriaEditor({
  sessionId,
  groups,
}: {
  sessionId: string;
  groups: GroupDTO[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);

  const run: RunFn = (fn) => {
    start(async () => {
      await fn();
      router.refresh();
    });
  };

  const submitAddGroup = (fd: FormData) => {
    run(async () => {
      await addGroup(sessionId, fd);
      setAddingGroup(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {preview ? "편집" : "미리보기"}
        </button>
        {!preview && (
          <button
            type="button"
            onClick={() => setAddingGroup((v) => !v)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            + 평가항목 추가
          </button>
        )}
      </div>

      {preview ? (
        <CriteriaPreviewTable groups={groups} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 font-medium">평가항목</th>
                <th className="w-px whitespace-nowrap px-3 py-2.5 font-medium">세부항목 추가</th>
                <th className="px-4 py-2.5 font-medium">세부항목</th>
                <th className="w-px whitespace-nowrap px-3 py-2.5 font-medium">평가지표 추가</th>
                <th className="px-4 py-2.5 font-medium">평가지표</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {addingGroup && (
                <tr className="border-b border-indigo-100 bg-indigo-50/40">
                  <td colSpan={COL_COUNT} className="px-4 py-3">
                    <form action={submitAddGroup} className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs text-slate-500">
                        평가항목명
                        <input name="name" required placeholder="예: 사업계획" className={`w-56 ${inputCls}`} autoFocus />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-slate-500">
                        목표배점
                        <input name="maxScore" type="number" step="any" defaultValue={0} className={`w-28 ${inputCls}`} />
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAddingGroup(false)} className={miniBtn}>취소</button>
                        <button disabled={pending} className={okBtn}>추가</button>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <GroupBlock key={g.id} group={g} run={run} pending={pending} />
              ))}
              {groups.length === 0 && !addingGroup && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-slate-400">
                    등록된 평가항목이 없습니다. 위에서 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 한 평가항목(그룹)의 모든 행을 생성. 각 셀 컴포넌트가 자체 편집/추가 토글을 소유하므로
// 클라이언트 상태와 무관하게 매 <tr>의 열 구조는 항상 7칸으로 고정된다(정렬·하이드레이션 안전).
function GroupBlock({ group, run, pending }: { group: GroupDTO; run: RunFn; pending: boolean }) {
  const groupRowSpan =
    group.subitems.reduce((n, s) => n + Math.max(1, s.criteria.length), 0) || 1;

  const rows: React.ReactNode[] = [];

  if (group.subitems.length === 0) {
    rows.push(
      <tr key={`${group.id}-empty`} className="border-b border-slate-100 last:border-0">
        <GroupNameCell group={group} rowSpan={1} run={run} pending={pending} />
        <AddSubitemCell groupId={group.id} rowSpan={1} run={run} pending={pending} />
        <td className="border-r border-slate-100 px-4 py-3 text-xs text-slate-400">—</td>
        <td className="border-r border-slate-100 px-3 py-3" />
        <td className="px-4 py-3 text-xs text-slate-400">세부항목을 추가하세요.</td>
        <td className="px-4 py-3" />
        <td className="px-4 py-3" />
      </tr>,
    );
  } else {
    let groupPlaced = false;
    group.subitems.forEach((s) => {
      const subRowSpan = Math.max(1, s.criteria.length);
      const leaves: (LeafDTO | null)[] = s.criteria.length ? s.criteria : [null];
      leaves.forEach((c, cIdx) => {
        const cells: React.ReactNode[] = [];
        if (!groupPlaced) {
          cells.push(
            <GroupNameCell key="g" group={group} rowSpan={groupRowSpan} run={run} pending={pending} />,
            <AddSubitemCell key="as" groupId={group.id} rowSpan={groupRowSpan} run={run} pending={pending} />,
          );
          groupPlaced = true;
        }
        if (cIdx === 0) {
          cells.push(
            <SubitemNameCell key="s" subitem={s} rowSpan={subRowSpan} run={run} pending={pending} />,
            <AddCriterionCell key="ac" subitemId={s.id} rowSpan={subRowSpan} run={run} pending={pending} />,
          );
        }
        if (c === null) {
          cells.push(
            <td key="ci" className="px-4 py-3 text-xs text-slate-400">평가지표를 추가하세요.</td>,
            <td key="sc" className="px-4 py-3" />,
            <td key="del" className="px-4 py-3" />,
          );
        } else {
          cells.push(<CriterionRowCells key="cr" criterion={c} run={run} pending={pending} />);
        }
        rows.push(
          <tr key={c ? c.id : s.id} className="border-b border-slate-100 last:border-0">
            {cells}
          </tr>,
        );
      });
    });
  }

  return <>{rows}</>;
}

function GroupNameCell({
  group,
  rowSpan,
  run,
  pending,
}: {
  group: GroupDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const total = groupTotal(group.subitems.flatMap((s) => s.criteria));
  const balanced = isGroupBalanced(group.maxScore, total);

  const submit = (fd: FormData) =>
    run(async () => {
      await updateGroup(group.id, fd);
      setEditing(false);
    });
  const onDelete = () => {
    if (!confirm(`'${group.name}' 평가항목과 하위 세부항목·평가지표를 모두 삭제할까요?`)) return;
    run(() => deleteGroup(group.id));
  };

  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-4 py-3 align-top">
      {editing ? (
        <form action={submit} className="flex flex-col gap-2">
          <input name="name" defaultValue={group.name} className={inputCls} autoFocus />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            목표배점
            <input name="maxScore" type="number" step="any" defaultValue={group.maxScore} className={`w-24 ${inputCls}`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>저장</button>
          </div>
        </form>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">{group.name}</span>
            <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="평가항목 수정">
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="평가항목 삭제" aria-label="평가항목 삭제">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-xs text-slate-400">
            합계 {total} / 목표 {group.maxScore}
            {!balanced && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-600">⚠ 불일치</span>}
          </div>
        </div>
      )}
    </td>
  );
}

function AddSubitemCell({
  groupId,
  rowSpan,
  run,
  pending,
}: {
  groupId: string;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const submit = (fd: FormData) =>
    run(async () => {
      await addSubitem(groupId, fd);
      setAdding(false);
    });
  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-3 py-3 align-top">
      {adding ? (
        <form action={submit} className="flex flex-col gap-1.5">
          <input name="name" required placeholder="세부항목명" className={`w-40 ${inputCls}`} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>추가</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`whitespace-nowrap ${miniBtn}`}>
          + 세부항목
        </button>
      )}
    </td>
  );
}

function SubitemNameCell({
  subitem,
  rowSpan,
  run,
  pending,
}: {
  subitem: SubitemDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const submit = (fd: FormData) =>
    run(async () => {
      await updateSubitem(subitem.id, fd);
      setEditing(false);
    });
  const onDelete = () => {
    if (!confirm(`'${subitem.name}' 세부항목과 하위 평가지표를 모두 삭제할까요?`)) return;
    run(() => deleteSubitem(subitem.id));
  };
  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-4 py-3 align-top">
      {editing ? (
        <form action={submit} className="flex flex-col gap-2">
          <input name="name" defaultValue={subitem.name} className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>저장</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700">{subitem.name}</span>
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="세부항목 수정">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="세부항목 삭제" aria-label="세부항목 삭제">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </td>
  );
}

function AddCriterionCell({
  subitemId,
  rowSpan,
  run,
  pending,
}: {
  subitemId: string;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const submit = (fd: FormData) =>
    run(async () => {
      await addCriterion(subitemId, fd);
      setAdding(false);
    });
  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-3 py-3 align-top">
      {adding ? (
        <form action={submit} className="flex flex-col gap-1.5">
          <input name="name" required placeholder="평가지표명" className={`w-48 ${inputCls}`} autoFocus />
          <input name="maxScore" type="number" step="any" placeholder="배점" defaultValue={0} className={`w-24 ${inputCls}`} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>추가</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`whitespace-nowrap ${miniBtn}`}>
          + 평가지표
        </button>
      )}
    </td>
  );
}

// 평가지표 편집은 이름·배점이 서로 다른 열(td)에 있어 <form>으로 감쌀 수 없으므로,
// 제어 입력 + 버튼 클릭 시 FormData를 구성해 액션을 호출한다(항상 3칸 고정).
function CriterionRowCells({
  criterion,
  run,
  pending,
}: {
  criterion: LeafDTO;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(criterion.name);
  const [score, setScore] = useState(String(criterion.maxScore));

  const save = () => {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("maxScore", score);
    run(async () => {
      await updateCriterion(criterion.id, fd);
      setEditing(false);
    });
  };
  const cancel = () => {
    setName(criterion.name);
    setScore(String(criterion.maxScore));
    setEditing(false);
  };
  const onDelete = () => {
    if (!confirm(`'${criterion.name}' 평가지표를 삭제할까요?`)) return;
    run(() => deleteCriterion(criterion.id));
  };

  if (editing) {
    return (
      <>
        <td className="px-4 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full ${inputCls}`} autoFocus />
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={cancel} className={miniBtn}>취소</button>
            <button type="button" onClick={save} disabled={pending} className={okBtn}>저장</button>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <input type="number" step="any" value={score} onChange={(e) => setScore(e.target.value)} className={`w-20 text-right ${inputCls}`} />
        </td>
        <td className="px-4 py-3" />
      </>
    );
  }

  return (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-700">{criterion.name}</span>
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="평가지표 수정">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{criterion.maxScore}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={onDelete} className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="평가지표 삭제" aria-label="평가지표 삭제">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </td>
    </>
  );
}
