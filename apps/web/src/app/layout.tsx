import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { type FeedStats, getStats } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz"],
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "homejobboard",
  description: "Single-user job aggregator: just-listed jobs, LLM-scored for fitness and ranked.",
};

async function StatsTicker() {
  let stats: FeedStats | null = null;
  try {
    stats = await getStats();
  } catch {
    return null;
  }
  return (
    <div className="hidden items-center gap-4 font-mono text-[11px] text-muted tracking-wide sm:flex">
      <span>
        inbox <strong className="font-medium text-foreground">{stats.new}</strong>
      </span>
      <span>
        applied <strong className="font-medium text-success">{stats.applied}</strong>
      </span>
      {stats.overdue > 0 && (
        <span>
          overdue <strong className="font-medium text-primary">{stats.overdue}</strong>
        </span>
      )}
      {stats.unscored > 0 && (
        <span>
          unscored <strong className="font-medium text-warn">{stats.unscored}</strong>
        </span>
      )}
      <span className="hidden md:inline">
        polled{" "}
        <strong className="font-medium text-foreground">
          {stats.lastPolledAt ? formatRelativeTime(stats.lastPolledAt) : "never"}
        </strong>
      </span>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        {/* Masthead: double-ruled like a broadsheet nameplate. */}
        <header className="border-foreground/80 border-b-2">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 pt-4 pb-2">
            <Link href="/" className="font-display text-2xl italic tracking-tight">
              homejobboard
            </Link>
            <nav className="flex gap-4 font-mono text-muted text-xs uppercase tracking-widest">
              <Link href="/" className="transition-colors hover:text-primary">
                Feed
              </Link>
              <Link href="/tracking" className="transition-colors hover:text-primary">
                Tracking
              </Link>
              <Link href="/settings" className="transition-colors hover:text-primary">
                Settings
              </Link>
            </nav>
            <div className="ms-auto">
              <StatsTicker />
            </div>
          </div>
          <div className="mx-auto max-w-5xl px-4">
            <div className="border-border border-t" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pt-2 pb-8">
          <div className="border-border border-t pt-3 font-mono text-[11px] text-muted">
            every board, one ranked feed · scored against your profile
          </div>
        </footer>
      </body>
    </html>
  );
}
