"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SessionsIcon, UsersIcon } from "./icons";
import { SESSION_TABS as SUB_ITEMS } from "@/lib/session-nav";

const APP_VERSION = "0.1.0";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "준비", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  IN_PROGRESS: {
    label: "진행중",
    cls: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  CLOSED: { label: "완료", cls: "bg-slate-200 text-slate-600 ring-slate-300" },
};

// 사이드바(어두운 배경)에서 분과 이름 옆 진행상태 텍스트 색상
const STATUS_TEXT: Record<string, string> = {
  DRAFT: "text-slate-400",
  IN_PROGRESS: "text-emerald-300",
  CLOSED: "text-slate-500",
};

type Session = {
  id: string;
  name: string;
  status: string;
  projectId?: string | null;
  projectName?: string | null;
};

function topCls(active: boolean) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    active
      ? "bg-white/10 text-white font-semibold"
      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
  }`;
}
function sessionCls(active: boolean) {
  return `block truncate rounded px-3 py-1.5 text-sm transition ${
    active
      ? "bg-white/10 text-white font-semibold"
      : "text-slate-400 hover:text-white"
  }`;
}
function leafCls(active: boolean) {
  return `block rounded px-3 py-1.5 transition ${
    active
      ? "bg-white/10 text-white"
      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
  }`;
}

// 세션 모드 하단의 분과 전환 드롭다운
function SessionSwitcher({
  sessions,
  currentId,
}: {
  sessions: Session[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = sessions.find((s) => s.id === currentId);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const select = (id: string) => {
    setOpen(false);
    if (id !== currentId) router.push(`/admin/sessions/${id}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current?.name ?? "분과 선택"}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-30 mb-1.5 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            분과 전환
          </div>
          {sessions.map((s) => {
            const active = s.id === currentId;
            const st = STATUS[s.status] ?? {
              label: s.status,
              cls: "bg-slate-100 text-slate-600 ring-slate-200",
            };
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${active ? "bg-indigo-50/60" : ""}`}
              >
                <span
                  className={`flex-1 truncate ${active ? "font-semibold text-indigo-700" : "text-slate-700"}`}
                >
                  {s.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}
                >
                  {st.label}
                </span>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">
              등록된 분과 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ProjectItem = {
  id: string;
  name: string;
  status: string;
  sessions: Session[];
};

// 마스터 사이드바: 과제 노드(접기/펼치기) + 하위 분과 목록
function ProjectNode({
  project,
  pathname,
}: {
  project: ProjectItem;
  pathname: string;
}) {
  const projActive = pathname === `/admin/projects/${project.id}`;
  const [open, setOpen] = useState(
    pathname.startsWith(`/admin/projects/${project.id}`),
  );
  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-1 text-slate-400 transition hover:text-white"
          aria-label={open ? "분과 접기" : "분과 펼치기"}
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            <path d="m7 5 5 5-5 5" />
          </svg>
        </button>
        <Link
          href={`/admin/projects/${project.id}`}
          className={`${sessionCls(projActive)} flex-1`}
          title={project.name}
        >
          <span className="truncate">{project.name}</span>
        </Link>
      </div>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
          {project.sessions.length === 0 && (
            <div className="px-3 py-1 text-[11px] text-slate-500">
              분과 없음
            </div>
          )}
          {project.sessions.map((s) => (
            <Link
              key={s.id}
              href={`/admin/sessions/${s.id}`}
              className={sessionCls(false)}
              title={`${s.name} · ${STATUS[s.status]?.label ?? s.status}`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`shrink-0 text-[10px] font-medium ${STATUS_TEXT[s.status] ?? "text-slate-400"}`}
                >
                  {STATUS[s.status]?.label ?? s.status}
                </span>
                <span className="truncate">{s.name}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSidebar({
  sessions,
  projects = [],
  role = "MASTER",
}: {
  sessions: Session[];
  projects?: ProjectItem[];
  role?: "MASTER" | "SECRETARY";
}) {
  const pathname = usePathname();
  const isMaster = role === "MASTER";
  const m = pathname.match(/^\/admin\/sessions\/([^/]+)/);
  const sid = m && m[1] !== "new" ? m[1] : null;
  const current = sid ? sessions.find((s) => s.id === sid) : null;

  const isExact = (p: string) => pathname === p;
  const sessionsActive =
    pathname === "/admin/sessions" || pathname === "/admin/sessions/new";
  const projectsActive = pathname.startsWith("/admin/projects");
  const leafActive = (suffix: string) =>
    suffix === ""
      ? isExact(`/admin/sessions/${sid}`)
      : pathname.startsWith(`/admin/sessions/${sid}${suffix}`);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-[var(--gov-navy)] text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div>
          <div className="text-sm font-bold leading-tight">심사·평가</div>
          <div className="text-[11px] text-slate-400">종합관리시스템</div>
        </div>
      </div>

      {sid ? (
        /* ── 세션 모드: 이 분과의 메뉴만 ── */
        <>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {(() => {
              // 분과의 소속 과제로 복귀(역할 무관). 미분류 분과만 분과 목록으로.
              const backHref = current?.projectId
                ? `/admin/projects/${current.projectId}`
                : "/admin/sessions";
              const backLabel = current?.projectName ?? "분과 목록";
              return (
                <Link
                  href={backHref}
                  className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
                  title={backLabel}
                >
                  <span aria-hidden>←</span>{" "}
                  <span className="truncate">{backLabel}</span>
                </Link>
              );
            })()}
            <div className="px-3 pb-2">
              <div
                className="truncate text-sm font-bold text-white"
                title={current?.name}
              >
                {current?.name ?? "분과"}
              </div>
              <div className="text-[11px] text-slate-400">분과 메뉴</div>
            </div>
            <div className="space-y-0.5">
              {SUB_ITEMS.map((it) => {
                const active = leafActive(it.suffix);
                return (
                  <Link
                    key={it.suffix}
                    href={`/admin/sessions/${sid}${it.suffix}`}
                    className={leafCls(active)}
                  >
                    <span
                      className={`block text-[13px] ${active ? "font-semibold" : "font-medium"}`}
                    >
                      {it.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}
                    >
                      {it.desc}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="border-t border-white/10 px-3 py-3">
            <SessionSwitcher sessions={sessions} currentId={sid} />
          </div>
        </>
      ) : (
        /* ── 글로벌 모드: 관리 메뉴 ── */
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {isMaster ? (
            /* 마스터: 과제 관리 + 과제 목록(클릭 시 그 과제의 분과 목록) */
            <div>
              <Link href="/admin/projects" className={topCls(projectsActive)}>
                <SessionsIcon />
                과제 관리
              </Link>
              <div className="mt-1 ml-1 space-y-0.5">
                {projects.length === 0 && (
                  <div className="px-3 py-1.5 text-xs text-slate-500">
                    등록된 과제 없음
                  </div>
                )}
                {projects.map((p) => (
                  <ProjectNode key={p.id} project={p} pathname={pathname} />
                ))}
              </div>
            </div>
          ) : (
            /* 간사: 내 분과 목록 */
            <div>
              <Link href="/admin/sessions" className={topCls(sessionsActive)}>
                <SessionsIcon />내 분과
              </Link>
              <div className="mt-1 ml-3 space-y-0.5 border-l border-white/15 pl-2">
                {sessions.length === 0 && (
                  <div className="px-3 py-1.5 text-xs text-slate-500">
                    등록된 분과 없음
                  </div>
                )}
                {sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/sessions/${s.id}`}
                    className={sessionCls(false)}
                    title={`${s.name} · ${STATUS[s.status]?.label ?? s.status}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`shrink-0 text-[10px] font-medium ${STATUS_TEXT[s.status] ?? "text-slate-400"}`}
                      >
                        {STATUS[s.status]?.label ?? s.status}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isMaster && (
            <Link
              href="/admin/evaluators"
              className={topCls(pathname.startsWith("/admin/evaluators"))}
            >
              <UsersIcon />
              평가위원 · 간사 관리
            </Link>
          )}
        </nav>
      )}

      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        심사·평가 종합관리시스템{" "}
        <span className="text-slate-400">v{APP_VERSION}</span>
      </div>
    </aside>
  );
}
