import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold text-slate-900 hover:text-indigo-600"
        >
          OpenDesign QA
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/runs/new" className="hover:text-slate-900">
            New Audit
          </Link>
          <Link href="/fixtures/test-landing" className="hover:text-slate-900">
            Test Landing
          </Link>
        </nav>
      </div>
    </header>
  );
}
