"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import { SESSION_TAB_LABEL as TAB_LABEL } from "@/lib/session-nav";

export default function SessionHeader({
  sessionId,
  sessionName,
  projectId,
}: {
  sessionId: string;
  sessionName: string;
  projectId: string | null;
}) {
  const pathname = usePathname();
  const base = `/admin/sessions/${sessionId}`;
  const suffix = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const tab = TAB_LABEL[suffix];
  const isMain = suffix === "";

  return (
    <div className="print:hidden">
      <Link
        href={projectId ? `/admin/projects/${projectId}` : "/admin/sessions"}
        className="text-sm text-slate-400 hover:text-slate-600"
      >
        ← {projectId ? "과제로" : "분과 목록"}
      </Link>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{tab ?? sessionName}</h1>
        {isMain && <DeleteSessionButton sessionId={sessionId} sessionName={sessionName} />}
      </div>
    </div>
  );
}
