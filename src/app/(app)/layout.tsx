import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import NavLink from "@/components/NavLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line-soft bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="neon-text text-lg font-bold tracking-tight">
            Neon<span className="text-brand">Quotes</span>
          </Link>

          <nav className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/settings">Settings</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted lg:inline">{session.email}</span>
            <Link href="/quotes/new" className="btn btn-primary">
              New quote
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
