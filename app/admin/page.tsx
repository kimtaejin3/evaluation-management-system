import { redirect } from "next/navigation";

// 메인 화면은 '심사 관리'(심사 목록). 대시보드(모니터링)는 각 심사 상세 페이지에 포함됨.
export default function AdminHome() {
  redirect("/admin/sessions");
}
