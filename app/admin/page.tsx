import { redirect } from "next/navigation";

// 메인 화면은 '분과 관리'(분과 목록). 대시보드(모니터링)는 각 분과 상세 페이지에 포함됨.
export default function AdminHome() {
  redirect("/admin/sessions");
}
