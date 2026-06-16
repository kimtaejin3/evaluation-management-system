"use client";

import { useRef, useState } from "react";

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

// 평가위원이 여러 심사 서류를 왼쪽 사이드에서 선택해 동시에 띄워놓고 비교하며 채점할 수 있는 프리뷰 보드
export default function DocPreviewBoard({
  documents,
}: {
  documents: PreviewDoc[];
}) {
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [railOpen, setRailOpen] = useState(true);
  const zTop = useRef(50);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  if (documents.length === 0) return null;

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
      const w = 440;
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

  const openIds = new Set(panes.map((p) => p.id));

  const tileAll = () =>
    setPanes((p) =>
      p.map((pane, i) => {
        const cols = Math.min(p.length, 3);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const startX = 252; // 왼쪽 서류함 폭 확보
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
      {/* 왼쪽 서류함 (선택 사이드바) */}
      {railOpen ? (
        <aside className="fixed left-3 top-28 bottom-3 z-30 flex w-56 flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-700">
              심사 서류 <span className="text-xs text-slate-400">{documents.length}</span>
            </span>
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="서류함 접기"
            >
              ‹
            </button>
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
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-transparent text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="shrink-0">{on ? "📂" : "📄"}</span>
                  <span className="line-clamp-2 flex-1 break-all leading-tight">
                    {d.name}
                  </span>
                  {on && (
                    <span className="shrink-0 text-[10px] font-medium text-indigo-400">
                      열림
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 p-2 text-xs text-slate-400">
            {panes.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={tileAll}
                  disabled={panes.length < 2}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  나란히 정렬
                </button>
                <button
                  type="button"
                  onClick={() => setPanes([])}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-50"
                >
                  모두 닫기
                </button>
              </div>
            ) : (
              <p className="px-1 leading-tight">
                서류를 클릭하면 프리뷰 창이 열립니다. 여러 개를 동시에 띄워 비교할 수 있어요.
              </p>
            )}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="fixed left-0 top-32 z-30 flex items-center gap-1 rounded-r-lg border border-l-0 border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-600 shadow-md transition hover:bg-slate-50"
          title="서류함 펼치기"
        >
          📁 서류 {panes.length > 0 && <span className="text-indigo-500">{panes.length}</span>}
        </button>
      )}

      {/* 플로팅 프리뷰 창들 */}
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

          {/* 내용 (리사이즈 가능) */}
          {!pane.minimized && (
            <div
              style={{ height: pane.h, resize: "both", overflow: "auto" }}
              className="min-h-50 min-w-65 bg-slate-50"
            >
              <iframe
                src={`/viewer/${pane.id}?embed=1`}
                title={pane.name}
                className="h-full w-full border-0"
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
