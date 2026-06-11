import AdminSidebar from "@/components/AdminSidebar";
import { getCurrentUser } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AdminSidebar userName={user?.name ?? "관리자"} />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>심사·평가 종합관리시스템</span>
          </div>
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              {user?.name ?? "관리자"}
            </span>{" "}
            님 · 관리자
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
