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
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
