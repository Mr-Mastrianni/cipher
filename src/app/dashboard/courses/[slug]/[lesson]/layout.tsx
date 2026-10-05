import type { Metadata } from "next";

/**
 * A client-component route cannot export `metadata` itself, so the title and
 * robots directive live in this thin server layout instead.
 */
export const metadata: Metadata = {
  title: "Lesson",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
