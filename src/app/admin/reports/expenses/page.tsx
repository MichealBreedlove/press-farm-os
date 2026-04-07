import { redirect } from "next/navigation";

// /admin/reports/expenses redirects to the dedicated /admin/expenses page
export default function AdminReportsExpensesPage() {
  redirect("/admin/expenses");
}
