"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  parseTsv,
  autoDetectMapping,
  looksLikeHeader,
  resolveHeader,
  buildCriteria,
  foldCriteria,
  CRITERION_FIELDS,
  type ColumnMapping,
  type CriterionField,
} from "@/lib/kpass-import";
import {
  commitKpassImport,
  parseSheetUpload,
  type KpassImportResult,
} from "@/app/admin/sessions/actions";
import { parseHtmlTable } from "./clipboard-table";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const SAMPLE = `평가항목\t세부항목\t평가지표\t배점\n사업계획\t사업 타당성\t시장 진입 가능성\t10\n사업계획\t사업 타당성\t수익 모델의 우수성\t10\n기대효과\t파급 효과\t고용 창출\t10`;

// 평가항목은 사업(Project) 단위 — 관리자가 사업 평가항목 페이지에서 가져온다.
export default function ImportCriteriaForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileGrid, setFileGrid] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [hasHeader, setHasHeader] = useState(true);
  const [override, setOverride] = useState<Record<number, CriterionField | null>>({});
  const [result, setResult] = useState<KpassImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const headerTouched = useRef(false);

  // 입력 소스: 파일이 있으면 파일 격자, 없으면 붙여넣기 텍스트 파싱
  const grid = useMemo(() => fileGrid ?? parseTsv(text), [fileGrid, text]);
  const colCount = useMemo(
    () => grid.reduce((m, r) => Math.max(m, r.length), 0),
    [grid],
  );

  useEffect(() => {
    if (headerTouched.current) return;
    setHasHeader(grid.length > 0 ? looksLikeHeader(grid[0]) : true);
  }, [grid]);

  // 헤더 해석(1행 또는 2행 머리글 자동 판별)
  const resolved = useMemo(() => resolveHeader(grid, hasHeader), [grid, hasHeader]);
  const headerRow = resolved.header;
  const auto = useMemo<ColumnMapping>(() => {
    const padded = Array.from({ length: colCount }, (_, i) => headerRow[i] ?? "");
    return autoDetectMapping(padded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCount, headerRow.join(""), hasHeader]);

  const mapping: ColumnMapping = useMemo(
    () =>
      Array.from({ length: colCount }, (_, i) =>
        i in override ? override[i] : auto[i] ?? null,
      ),
    [colCount, override, auto],
  );

  const preview = useMemo(
    () => buildCriteria(grid, mapping, { hasHeader, typeMode: "auto" }),
    [grid, mapping, hasHeader],
  );
  // 미리보기용 3단 트리 + 통합배점 판별(커밋과 동일 규칙). 같은 평가항목/세부항목은 합쳐 보여준다.
  const foldedPreview = useMemo(() => foldCriteria(preview.rows), [preview.rows]);

  const sampleRows = grid.slice(resolved.dataStart, resolved.dataStart + 3);
  const nameMapped = mapping.includes("name");
  const showGroup = mapping.includes("group");
  const showSubitem = mapping.includes("subitem");
  const showWeight = mapping.includes("weight");

  const resetSource = () => {
    setOverride({});
    setResult(null);
    headerTouched.current = false;
  };

  const onFile = async (file: File | null) => {
    setFileError(null);
    if (!file) return;
    setText("");
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await parseSheetUpload(fd);
    setParsing(false);
    if (res.error || res.grid.length === 0) {
      setFileError(res.error ?? "표를 찾지 못했습니다.");
      setFileGrid(null);
      setFileName(null);
      return;
    }
    resetSource();
    setFileGrid(res.grid);
    setFileName(file.name);
  };

  // 붙여넣기 시 클립보드에 HTML 표가 있으면(한글/엑셀/워드) 구조 그대로 복원
  const onPasteCapture = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData("text/html");
    const g = html ? parseHtmlTable(html) : null;
    if (g && g.length > 1) {
      e.preventDefault();
      setText("");
      setFileError(null);
      resetSource();
      setFileGrid(g);
      setFileName("붙여넣은 표");
    }
  };

  const onPaste = (v: string) => {
    setFileGrid(null);
    setFileName(null);
    setFileError(null);
    resetSource();
    setText(v);
  };

  const setCol = (i: number, v: string) =>
    setOverride((o) => ({ ...o, [i]: v === "" ? null : (v as CriterionField) }));

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const res = await commitKpassImport(projectId, {
        grid,
        mapping,
        hasHeader,
        typeMode: "auto",
        replaceCriteria: true,
      });
      setResult(res);
      if (res.ok) {
        router.refresh();
        onDone();
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 1) 입력: 파일 업로드 또는 붙여넣기 */}
      <section className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">
          1. 평가표 가져오기 — 엑셀 파일 업로드 또는 붙여넣기
        </label>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {parsing && <span className="text-xs text-slate-400">읽는 중…</span>}
          {fileName && !parsing && (
            <span className="text-xs font-medium text-emerald-600">{fileName} 불러옴</span>
          )}
          <span className="text-xs text-slate-400">.xlsx · .xls · .csv (최대 4MB) · 한글(HWP)은 파일 업로드 불가</span>
        </div>
        {fileError && <p className="text-xs font-medium text-rose-600">{fileError}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">또는 엑셀·한글에서 표를 드래그·복사해 아래에 붙여넣기(한글은 이 방식만 가능)</span>
          <button
            type="button"
            onClick={() => onPaste(SAMPLE)}
            className="text-xs text-slate-400 hover:text-indigo-600"
          >
            예시 채우기
          </button>
        </div>
        <textarea
          value={fileGrid ? "" : text}
          onPaste={onPasteCapture}
          onChange={(e) => onPaste(e.target.value)}
          disabled={!!fileGrid}
          rows={4}
          placeholder={fileGrid ? "표를 불러왔습니다. 다시 붙여넣으려면 위 ‘예시 채우기’ 옆이 아니라 모달을 닫았다 열어 주세요." : "한글/엑셀 표를 복사해 Ctrl+V (병합셀·여러 줄 자동 인식)"}
          className={`w-full font-mono text-xs ${inputCls} disabled:bg-slate-50`}
        />
        {colCount > 0 && (
          <p className="text-xs text-slate-400">
            감지된 열 {colCount}개 · 데이터 {Math.max(grid.length - resolved.dataStart, 0)}행
            {resolved.dataStart === 2 && " · 2행 머리글 인식됨"}
          </p>
        )}
      </section>

      {colCount > 0 && (
        <>
          {/* 2) 옵션 + 열 매핑 */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => {
                    headerTouched.current = true;
                    setHasHeader(e.target.checked);
                  }}
                />
                첫 행은 머리글(헤더)
              </label>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600">
                ⚠ 이 분과의 기존 평가항목을 모두 지우고 새로 채웁니다
              </span>
              <span className="text-xs text-slate-400">채점이 시작된 분과는 차단됩니다.</span>
            </div>

            <div className="text-sm font-semibold text-slate-700">
              2. 각 열을 어떤 항목으로 가져올지 지정
            </div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 font-medium">엑셀 열</th>
                    <th className="px-3 py-2 font-medium">샘플 값</th>
                    <th className="px-3 py-2 font-medium">→ 가져올 항목</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: colCount }, (_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {hasHeader ? headerRow[i] || `(빈 머리글 ${i + 1})` : `${i + 1}번째 열`}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {sampleRows.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={mapping[i] ?? ""}
                          onChange={(e) => setCol(i, e.target.value)}
                          className={inputCls}
                        >
                          <option value="">무시</option>
                          {CRITERION_FIELDS.map((f) => (
                            <option key={f.field} value={f.field}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!nameMapped && (
              <p className="text-xs font-medium text-rose-600">
                * 한 열을 반드시 “평가지표”로 지정하세요. (평가항목·세부항목은 선택)
              </p>
            )}
          </section>

          {/* 3) 미리보기 */}
          <section className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">
              3. 미리보기{" "}
              <span className="text-xs text-slate-400">
                {preview.rows.length}개 항목 생성 예정
              </span>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="max-h-24 space-y-1 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {preview.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            {preview.rows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-center text-slate-500">
                    <tr className="border-b border-slate-200">
                      {showGroup && <th className="whitespace-nowrap px-3 py-2 font-medium">평가항목</th>}
                      {showSubitem && <th className="whitespace-nowrap px-3 py-2 font-medium">세부항목</th>}
                      <th className="px-3 py-2 font-medium">평가지표</th>
                      <th className="whitespace-nowrap px-3 py-2 text-center font-medium">배점</th>
                      {showWeight && <th className="whitespace-nowrap px-3 py-2 text-center font-medium">가중치</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {foldedPreview.map((g) => {
                      const groupRowSpan = g.subitems.reduce(
                        (a, s) => a + Math.max(1, s.leaves.length),
                        0,
                      );
                      let groupPlaced = false;
                      return g.subitems.map((s, si) => {
                        const subRowSpan = Math.max(1, s.leaves.length);
                        const lump = s.lumpScore != null;
                        return s.leaves.map((leaf, li) => {
                          const cells: React.ReactNode[] = [];
                          if (showGroup && !groupPlaced) {
                            groupPlaced = true;
                            cells.push(
                              <td
                                key="g"
                                rowSpan={groupRowSpan}
                                className="border-r border-slate-100 px-3 py-2 text-center align-middle font-medium text-slate-700"
                              >
                                {g.name}
                              </td>,
                            );
                          }
                          if (showSubitem && li === 0) {
                            cells.push(
                              <td
                                key="s"
                                rowSpan={subRowSpan}
                                className="border-r border-slate-100 px-3 py-2 text-center align-middle text-slate-600"
                              >
                                {s.name}
                                {lump && (
                                  <span className="mt-1 block">
                                    <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                                      통합 배점
                                    </span>
                                  </span>
                                )}
                              </td>,
                            );
                          }
                          cells.push(
                            <td key="n" className="px-3 py-2 text-slate-800">
                              {leaf.name}
                            </td>,
                          );
                          if (lump) {
                            if (li === 0)
                              cells.push(
                                <td
                                  key="m"
                                  rowSpan={subRowSpan}
                                  className="whitespace-nowrap px-3 py-2 text-center align-middle font-semibold text-slate-800"
                                >
                                  {s.lumpScore}
                                </td>,
                              );
                          } else {
                            cells.push(
                              <td key="m" className="whitespace-nowrap px-3 py-2 text-center text-slate-700">
                                {leaf.maxScore}
                              </td>,
                            );
                          }
                          if (showWeight)
                            cells.push(
                              <td key="w" className="whitespace-nowrap px-3 py-2 text-center text-slate-500">
                                {lump ? "—" : leaf.weight}
                              </td>,
                            );
                          return (
                            <tr key={`${g.name}-${si}-${li}`} className="border-b border-slate-100">
                              {cells}
                            </tr>
                          );
                        });
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 4) 실행 */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            {result && !result.ok && (
              <span className="mr-auto text-sm font-medium text-rose-600">{result.error}</span>
            )}
            <button
              type="button"
              onClick={onDone}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pending || preview.rows.length === 0 || !nameMapped}
              onClick={submit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "가져오는 중…" : `${preview.rows.length}개 항목 가져오기`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
