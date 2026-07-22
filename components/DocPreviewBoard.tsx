"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface PreviewDoc {
  id: string;
  name: string;
  mimeType: string;
}

interface PaneState {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
}

// 평가위원이 여러 분과 서류를 왼쪽 사이드에서 선택해 동시에 띄워놓고 비교하며 채점할 수 있는 프리뷰 보드
export default function DocPreviewBoard({
  documents,
  docked = false,
}: {
  documents: PreviewDoc[];
  // docked=true: 좌측 도킹 목록(항상 보임) + 클릭 시 플로팅 창. false: 인라인 드롭다운
  docked?: boolean;
}) {
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const zTop = useRef(1000);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resize = useRef<{
    id: string;
    sx: number;
    sy: number;
    w0: number;
    h0: number;
  } | null>(null);

  if (documents.length === 0) {
    if (!docked) return null;
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
        등록된 분과 자료가 없습니다.
      </div>
    );
  }

  const bringFront = (id: string) =>
    setPanes((p) =>
      p.map((pane) => (pane.id === id ? { ...pane, z: ++zTop.current } : pane)),
    );

  const open = (d: PreviewDoc) => {
    setPanes((p) => {
      const existing = p.find((pane) => pane.id === d.id);
      if (existing) {
        // 이미 열려 있으면 최상단으로 + 펼치기
        return p.map((pane) =>
          pane.id === d.id
            ? { ...pane, minimized: false, z: ++zTop.current }
            : pane,
        );
      }
      const i = p.length;
      // 기본 프리뷰 창 너비(기존 440 → 1.5배). 화면이 좁으면 화면폭에 맞춤
      const w =
        typeof window !== "undefined"
          ? Math.min(660, window.innerWidth - 32)
          : 660;
      // 왼쪽 서류함을 가리지 않도록 화면 오른쪽에서 계단식으로 띄움
      const baseX =
        typeof window !== "undefined"
          ? Math.max(260, window.innerWidth - w - 24)
          : 700;
      return [
        ...p,
        {
          id: d.id,
          name: d.name,
          x: Math.max(260, baseX - (i % 4) * 48),
          y: 80 + (i % 4) * 40,
          w,
          h: 560,
          z: ++zTop.current,
          minimized: false,
        },
      ];
    });
  };

  const toggle = (d: PreviewDoc) => {
    if (panes.some((p) => p.id === d.id)) close(d.id);
    else open(d);
  };

  const close = (id: string) =>
    setPanes((p) => p.filter((pane) => pane.id !== id));
  const toggleMin = (id: string) =>
    setPanes((p) =>
      p.map((pane) =>
        pane.id === id ? { ...pane, minimized: !pane.minimized } : pane,
      ),
    );

  const onPointerDown = (e: React.PointerEvent, pane: PaneState) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: pane.id,
      dx: e.clientX - pane.x,
      dy: e.clientY - pane.y,
    };
    bringFront(pane.id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPanes((p) =>
      p.map((pane) =>
        pane.id === d.id
          ? {
              ...pane,
              x: Math.max(0, e.clientX - d.dx),
              y: Math.max(0, e.clientY - d.dy),
            }
          : pane,
      ),
    );
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // 창 자체 리사이즈(우측 하단 핸들)
  const onResizeDown = (e: React.PointerEvent, pane: PaneState) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resize.current = {
      id: pane.id,
      sx: e.clientX,
      sy: e.clientY,
      w0: pane.w,
      h0: pane.h,
    };
    bringFront(pane.id);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r) return;
    const w = Math.max(280, r.w0 + (e.clientX - r.sx));
    const h = Math.max(200, r.h0 + (e.clientY - r.sy));
    setPanes((p) =>
      p.map((pane) => (pane.id === r.id ? { ...pane, w, h } : pane)),
    );
  };
  const onResizeUp = () => {
    resize.current = null;
  };

  const openIds = new Set(panes.map((p) => p.id));

  const tileAll = () =>
    setPanes((p) =>
      p.map((pane, i) => {
        const cols = Math.min(p.length, 3);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const startX = 24;
        const w = Math.floor((window.innerWidth - startX - 24) / cols) - 12;
        return {
          ...pane,
          minimized: false,
          x: startX + col * (w + 12),
          y: 80 + row * 300,
          w,
          h: 540,
          z: ++zTop.current,
        };
      }),
    );

  return (
    <>
      {/* 좌측 도킹 목록(클릭 시 플로팅 창) */}
      {docked && (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">
              분과 자료 <span className="text-xs font-normal text-slate-400">{documents.length}</span>
            </span>
            {panes.length > 0 && (
              <button type="button" onClick={() => setPanes([])} className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                모두 닫기
              </button>
            )}
          </div>
          <div className="flex-1 space-y-1 overflow-auto p-2">
            {documents.map((d) => {
              const on = openIds.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggle(d)}
                  title={d.name}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                    on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-transparent text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="line-clamp-2 flex-1 break-all leading-tight">{d.name}</span>
                  {on && <span className="shrink-0 text-xs font-medium text-indigo-400">열림</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-2 text-xs text-slate-400">
            {panes.length > 1 ? (
              <button type="button" onClick={tileAll} className="w-full rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-50">나란히 정렬</button>
            ) : (
              <p className="px-1 leading-tight">자료를 클릭하면 창으로 열립니다. 여러 개를 띄워 비교할 수 있어요.</p>
            )}
          </div>
        </div>
      )}

      {/* 인라인 드롭다운(비-도킹 모드에서만) */}
      {!docked && (
      <div ref={menuRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          📁 분과 서류 <span className="text-xs text-slate-400">{documents.length}</span>
          {panes.length > 0 && <span className="text-xs font-medium text-indigo-500">· {panes.length} 열림</span>}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} aria-hidden>
            <path d="m5 8 5 5 5-5" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <div className="max-h-72 space-y-1 overflow-auto p-1">
              {documents.map((d) => {
                const on = openIds.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggle(d)}
                    title={d.name}
                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                      on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-transparent text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="shrink-0">{on ? "📂" : "📄"}</span>
                    <span className="line-clamp-2 flex-1 break-all leading-tight">{d.name}</span>
                    {on && <span className="shrink-0 text-xs font-medium text-indigo-400">열림</span>}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 p-2 text-xs text-slate-400">
              {panes.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={tileAll} disabled={panes.length < 2} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">나란히 정렬</button>
                  <button type="button" onClick={() => setPanes([])} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-50">모두 닫기</button>
                </div>
              ) : (
                <p className="px-1 leading-tight">서류를 클릭하면 프리뷰 창이 열립니다. 여러 개를 동시에 띄워 비교할 수 있어요.</p>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* 플로팅 프리뷰 창들 — body로 portal(부모 stacking context 탈출 → 항상 최상단) */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {panes.map((pane) => (
        <div
          key={pane.id}
          onPointerDown={() => bringFront(pane.id)}
          style={{ left: pane.x, top: pane.y, width: pane.w, zIndex: pane.z }}
          className="fixed flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
        >
          {/* 타이틀바 (드래그 핸들) */}
          <div
            onPointerDown={(e) => onPointerDown(e, pane)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex cursor-move touch-none select-none items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2"
          >
            <span className="truncate text-xs font-semibold text-slate-700">
              📄 {pane.name}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <a
                href={`/viewer/${pane.id}`}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-indigo-600"
                title="새 탭에서 열기"
              >
                ↗
              </a>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => toggleMin(pane.id)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white"
                title={pane.minimized ? "펼치기" : "접기"}
              >
                {pane.minimized ? "▢" : "—"}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => close(pane.id)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-rose-600"
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 내용 */}
          {!pane.minimized && (
            <div style={{ height: pane.h }} className="relative bg-slate-50">
              <iframe
                src={`/viewer/${pane.id}?embed=1`}
                title={pane.name}
                className="h-full w-full border-0"
              />
              {/* 창 리사이즈 핸들(우측 하단) */}
              <div
                onPointerDown={(e) => onResizeDown(e, pane)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-se-resize touch-none"
                title="창 크기 조절"
              >
                <svg
                  viewBox="0 0 10 10"
                  className="h-full w-full text-slate-400"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M9 1v8H1z" opacity="0.25" />
                  <circle cx="8" cy="8" r="0.9" />
                  <circle cx="5.5" cy="8" r="0.9" />
                  <circle cx="8" cy="5.5" r="0.9" />
                </svg>
              </div>
            </div>
          )}
        </div>
            ))}
          </>,
          document.body,
        )}
    </>
  );
}
