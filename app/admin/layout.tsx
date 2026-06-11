import AdminSidebar from "@/components/AdminSidebar";
import HeaderTitle from "@/components/HeaderTitle";
import { getCurrentUser } from "@/lib/session";
import { logout } from "@/app/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AdminSidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-3">
          <HeaderTitle />
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-700">
                {user?.name ?? "관리자"}
              </span>{" "}
              님 · 관리자
            </span>
            <form action={logout}>
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50">
                로그아웃
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
