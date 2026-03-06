import { redirect } from "next/navigation";

export default function InsightsPage() {
  // Always send users to the KPI screen inside Explore Data/Assistant
  redirect("/assistant?tab=civic");
}