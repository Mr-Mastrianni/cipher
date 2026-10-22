import { redirect } from "next/navigation";

/**
 * The world used to live here, inside the dashboard shell. It now has its own
 * full-screen route; this keeps old links working and sends everyone to `/world`.
 */
export default function LegacyWorldPage() {
  redirect("/world");
}
