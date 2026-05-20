import Link from "next/link";

export default function TestLandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 pb-20 pt-6">
      <header className="rounded-[20px] border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-2xl font-bold tracking-tight text-slate-900">AcmeOps</span>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Sign in
            </a>
            <a
              href="#"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Start free
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-8 rounded-[28px] bg-gradient-to-r from-blue-700 to-blue-950 px-8 py-10 text-white shadow-xl lg:grid-cols-[1.15fr_1fr] lg:px-16 lg:py-14">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit rounded-full bg-blue-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-blue-700">
            Ops Command Center
          </span>
          <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Ship faster with reliable release quality.
          </h1>
          <p className="max-w-xl text-base text-blue-100 sm:text-lg">
            Monitor test quality, release health, and user impact in one timeline.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#"
              className="rounded-[14px] bg-white px-6 py-3 text-base font-bold text-blue-700"
            >
              Start free
            </a>
            <a
              href="#"
              className="rounded-[14px] border border-blue-100 bg-blue-600 px-6 py-3 text-base font-semibold text-white"
            >
              Book demo
            </a>
          </div>
        </div>

        <aside className="rounded-3xl bg-white p-8 text-slate-900 shadow-md">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-xl font-bold">Release quality score</h2>
            <span className="text-xl font-bold text-blue-700">84%</span>
          </div>
          <div className="mt-5 h-2.5 rounded-full bg-slate-200">
            <div className="h-2.5 w-4/5 rounded-full bg-blue-600" />
          </div>
          <div className="mt-7 grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
              <span className="font-medium text-slate-900">Regression risk</span>
              <span className="font-bold text-emerald-600">Low</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
              <span className="font-medium text-slate-900">Build health</span>
              <span className="font-bold text-amber-600">Needs review</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
              <span className="font-medium text-slate-900">User impact</span>
              <span className="font-bold text-sky-500">Moderate</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-4xl font-bold tracking-tight text-slate-900">
          Everything your release team needs
        </h2>
        <p className="text-lg text-slate-600">
          A practical dashboard for engineering managers and QA leads.
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <article className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-900">Issue Radar</h3>
            <p className="mt-4 text-base text-slate-600">
              Surface flaky tests and unstable builds before release day.
            </p>
          </article>
          <article className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-900">Change Timeline</h3>
            <p className="mt-4 text-base text-slate-600">
              Track design, code, and QA changes in one chronological feed.
            </p>
          </article>
          <article className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-900">Audit Reports</h3>
            <p className="mt-4 text-base text-slate-600">
              Generate shareable reports for product and engineering stakeholders.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-12 shadow-sm sm:px-12">
        <h2 className="text-4xl font-bold tracking-tight text-slate-900">Simple pricing</h2>
        <p className="mt-3 text-lg text-slate-600">Start with one team and scale confidently.</p>
        <div className="mt-10 flex flex-wrap items-end gap-3">
          <span className="text-6xl font-bold text-slate-900">$49</span>
          <span className="pb-2 text-2xl text-slate-500">per user/month</span>
        </div>
        <button className="mt-8 rounded-[14px] bg-blue-600 px-8 py-3 text-lg font-bold text-white">
          Get started
        </button>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 text-sm text-blue-900 sm:px-8">
        <p className="font-semibold">Test audit inputs</p>
        <p className="mt-2">
          Website URL: <span className="font-mono">http://localhost:3000/fixtures/test-landing</span>
        </p>
        <p className="mt-1">
          Figma URL: <span className="font-mono">http://localhost:3000/figma/test-landing-frame.svg</span>
        </p>
        <p className="mt-3 text-blue-800">
          Open the new audit form and paste these two values to generate a repeatable test report.
        </p>
        <Link href="/runs/new" className="mt-4 inline-block font-semibold text-blue-700 underline">
          Go to New Audit form
        </Link>
      </section>
    </div>
  );
}
