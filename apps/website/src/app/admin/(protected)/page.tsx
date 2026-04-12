import { AdminAnalyticsDashboard } from "@/components/admin/AdminAnalyticsDashboard";
import { AdminTriageDashboard } from "@/components/admin/AdminTriageDashboard";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <AdminAnalyticsDashboard />
      <AdminTriageDashboard />
    </div>
  );
}
