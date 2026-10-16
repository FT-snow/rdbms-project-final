/**
 * Persistent app shell: fixed sidebar navigation + content frame.
 * Guards every child route with requireSession().
 */
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/server/actions";
import { NavLink } from "@/components/nav-links";
import { FlashBanner } from "@/components/flash-banner";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <header className="border-b border-line bg-bone md:border-b-0 md:border-r">
        <div className="flex h-full flex-col p-6 max-md:p-4">
          <Link href="/dashboard" className="font-serif text-xl tracking-[-0.02em]">
            St. Martha&rsquo;s Clinic
          </Link>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mute">
            Appointment System
          </p>

          <nav
            aria-label="Primary"
            className="mt-8 flex space-x-4 overflow-x-auto text-sm md:mt-0 md:flex-1 md:flex-col md:space-x-0 md:py-0"
          >
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/patients">Patients</NavLink>
            <NavLink href="/doctors">Doctors</NavLink>
            <NavLink href="/book?date=today">Book appointment</NavLink>
            <NavLink href="/medicines">Medicines</NavLink>
            <NavLink href="/reports">Reports</NavLink>
          </nav>

          <footer className="mt-8 space-y-2 border-t border-line pt-4 md:mt-0">
            <p className="font-mono text-[11px] text-mute">
              {session.username} ·{" "}
              <span className="uppercase tracking-[0.08em]">{session.role}</span>
            </p>
            <form action={logoutAction}>
              <button className="text-xs text-mute underline decoration-line underline-offset-4 hover:text-ink">
                Sign out
              </button>
            </form>
            <p className="pt-2 text-[10px] leading-relaxed text-mute/70">
              Built by Prakhar · Shaurya · Tanay
            </p>
          </footer>
        </div>
      </header>

      <main className="container max-w-6xl px-6 py-10 md:px-10 md:py-12">
        <FlashBanner />
        {children}
      </main>
    </div>
  );
}
