"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editSubject, deleteSubject, deleteSubjectDocument } from "@/app/admin/sessions/actions";
import SubjectUploadForm from "@/components/SubjectUploadForm";

export type SubjectRow = {
  id: string;
  companyId: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  businessNo: string | null;
  region: string | null;
  leadResearcher: string | null;
  description: string | null;
  documents: { id: string; originalName: string; size: number }[];
};

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 평가 대상 상태 — 텍스트만(대기=회색, 승인=검정, 반려=빨강)
function StatusText({ status }: { status: SubjectRow["status"] }) {
  const map = {
    PENDING: { label: "대기", cls: "text-slate-500" },
    APPROVED: { label: "승인", cls: "font-semibold text-slate-900" },
    REJECTED: { label: "반려", cls: "text-rose-600" },
  } as const;
  const s = map[status];
  return <span className={`text-xs whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

// 담당자의 평가 대상 목록 — 테이블 UI + 수정/서류 모달. 편집은 canEdit(작성/반려)일 때만.
export default function SubjectsTable({
  sessionId,
  subjects,
  canEdit,
}: {
  sessionId: string;
  subjects: SubjectRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editRow, setEditRow] = useState<SubjectRow | null>(null);
  const [docRow, setDocRow] = useState<SubjectRow | null>(null);

  const submitEdit = (fd: FormData) => {
    if (!editRow) return;
    start(async () => {
      await editSubject(sessionId, editRow.id, fd);
      setEditRow(null);
      router.refresh();
    });
  };
  const remove = (s: SubjectRow) => {
    if (!confirm(`'${s.name}'을(를) 이 분과에서 제외할까요?`)) return;
    start(async () => {
      await deleteSubject(sessionId, s.id);
      router.refresh();
    });
  };
  const removeDoc = (docId: string) => {
    start(async () => {
      await deleteSubjectDocument(sessionId, docId);
      router.refresh();
    });
  };

  // 모달의 최신 데이터(refresh 후 props 갱신 반영 — 문서 목록 등)
  const curDoc = docRow ? subjects.find((s) => s.id === docRow.id) ?? docRow : null;
  const curEdit = editRow ? subjects.find((s) => s.id === editRow.id) ?? editRow : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {subjects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          편입된 평가 대상이 없습니다.{canEdit && " 위에서 기업을 추가하세요."}
        </p>
      ) : (
        <table className="table-grid w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-12 px-5 py-2.5 font-medium">번호</th>
              <th className="px-5 py-2.5 font-medium">기업명</th>
              <th className="px-5 py-2.5 font-medium">사업자번호</th>
              <th className="px-5 py-2.5 font-medium">지역</th>
              <th className="px-5 py-2.5 font-medium">연구책임자</th>
              <th className="px-5 py-2.5 font-medium">서류</th>
              <th className="px-5 py-2.5 font-medium">상태</th>
              {canEdit && <th className="px-5 py-2.5 font-medium">관리</th>}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-2.5 tabular-nums text-slate-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-medium text-slate-800">{s.name}</td>
                <td className="px-5 py-2.5 text-slate-600">
                  {s.businessNo ?? <span className="text-slate-300">미등록</span>}
                </td>
                <td className="px-5 py-2.5 text-slate-600">
                  {s.region ?? <span className="text-slate-300">미등록</span>}
                </td>
                <td className="px-5 py-2.5 text-slate-600">
                  {s.leadResearcher ?? <span className="text-slate-300">미등록</span>}
                </td>
                <td className="px-5 py-2.5">
                  <button
                    type="button"
                    onClick={() => setDocRow(s)}
                    className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                  >
                    {canEdit ? "관리" : "보기"} ({s.documents.length})
                  </button>
                </td>
                <td className="px-5 py-2.5">
                  <StatusText status={s.status} />
                </td>
                {canEdit && (
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRow(s)}
                        className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s)}
                        disabled={pending}
                        className="text-xs whitespace-nowrap text-slate-400 transition hover:text-rose-600 hover:underline disabled:opacity-50"
                      >
                        제외
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 수정 모달 — 기업 정보 + 서류 관리(폼 중첩 방지: 서류 섹션은 정보 폼 밖) */}
      {curEdit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4" onClick={() => setEditRow(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">평가 대상 수정</h3>
                <p className="mt-0.5 text-xs text-slate-400">{curEdit.name} · 정보 수정 시 관리자 재검토(대기)로 전환됩니다.</p>
              </div>
              <button type="button" onClick={() => setEditRow(null)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">✕</button>
            </div>

            {/* 기업 정보 폼 */}
            <form action={submitEdit} className="space-y-4">
              <label className="block text-xs text-slate-500">
                지역
                <input name="region" required defaultValue={curEdit.region ?? ""} placeholder="지역" className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="block text-xs text-slate-500">
                연구책임자
                <input name="leadResearcher" required defaultValue={curEdit.leadResearcher ?? ""} placeholder="연구책임자" className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="block text-xs text-slate-500">
                사업자등록번호 <span className="text-slate-400">(선택)</span>
                <input name="businessNo" defaultValue={curEdit.businessNo ?? ""} placeholder="사업자등록번호" className={`mt-1 w-full ${inputCls}`} />
              </label>
              {curEdit.status === "REJECTED" && curEdit.rejectionReason && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  반려 사유: {curEdit.rejectionReason}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditRow(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                  닫기
                </button>
                <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
                  {pending ? "저장 중…" : "정보 저장"}
                </button>
              </div>
            </form>

            {/* 분과 서류 — 정보 폼과 별도로 관리(업로드/삭제) */}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">분과 서류 ({curEdit.documents.length})</div>
              <ul className="space-y-1">
                {curEdit.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <a href={`/viewer/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                      <span>📄</span>
                      <span>{d.originalName}</span>
                      <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                    </a>
                    <button type="button" onClick={() => removeDoc(d.id)} disabled={pending} className="ml-2 shrink-0 text-xs text-slate-400 hover:text-rose-600 hover:underline disabled:opacity-50">
                      삭제
                    </button>
                  </li>
                ))}
                {curEdit.documents.length === 0 && <li className="text-sm text-slate-400">등록된 자료가 없습니다. 아래에서 업로드하세요.</li>}
              </ul>
              <SubjectUploadForm sessionId={sessionId} companyId={curEdit.companyId} />
            </div>
          </div>
        </div>
      )}

      {/* 서류 모달 */}
      {curDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4" onClick={() => setDocRow(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-800">{curDoc.name} — 분과 서류</h3>
              <button type="button" onClick={() => setDocRow(null)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">✕</button>
            </div>
            <ul className="space-y-1">
              {curDoc.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <a href={`/viewer/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                    <span>📄</span>
                    <span>{d.originalName}</span>
                    <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                  </a>
                  {canEdit && (
                    <button type="button" onClick={() => removeDoc(d.id)} disabled={pending} className="ml-2 shrink-0 text-xs text-slate-400 hover:text-rose-600 hover:underline disabled:opacity-50">
                      삭제
                    </button>
                  )}
                </li>
              ))}
              {curDoc.documents.length === 0 && (
                <li className="text-sm text-slate-400">등록된 자료가 없습니다.{canEdit && " 아래에서 업로드하세요."}</li>
              )}
            </ul>
            {canEdit && <SubjectUploadForm sessionId={sessionId} companyId={curDoc.companyId} />}
          </div>
        </div>
      )}
    </div>
  );
}
