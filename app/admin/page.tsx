import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/authz";

// 메인 진입 — 마스터는 과제 관리, 간사는 첫 참여 과제의 분과 목록으로.
export default async function AdminHome() {
  const user = await requireAdminUser();
  if (user.role === "MASTER") redirect("/admin/projects");
  const first = await prisma.project.findFirst({
    where: { secretaries: { some: { id: user.id } } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  redirect(first ? `/admin/projects/${first.id}` : "/admin/sessions");
}
