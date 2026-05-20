import Link from "next/link";

export default function Home() {
  const currentFeatures = [
    {
      title: "Multi-viewport audit runs",
      description:
        "Run checks across desktop, tablet, and mobile viewports from a single audit setup.",
    },
    {
      title: "Figma frame comparison",
      description:
        "Attach a Figma frame URL and review side-by-side screenshots with clear mismatch context.",
    },
    {
      title: "Evidence-backed findings",
      description:
        "Inspect severity-tagged findings with viewport context, screenshots, and remediation hints.",
    },
    {
      title: "Exportable reports",
      description:
        "Share JSON and Markdown audit reports with engineering, design, and QA stakeholders.",
    },
    {
      title: "Artifact source transparency",
      description:
        "See where each visual artifact came from, including direct URLs and Figma API exports.",
    },
    {
      title: "Local-first open-source workflow",
      description:
        "Run the full stack locally with API, worker, storage, and web app under your control.",
    },
  ];

  const upcomingFeatures = [
    "Real capture pipeline with deeper rules execution",
    "Dynamic ignore rules to reduce recurring noise",
    "Root-cause diagnostics for faster fixes",
    "Review workflow with acknowledged/ignored/resolved states",
    "Cross-browser capture profiles",
    "Figma-to-live tolerance presets and normalized delta scoring",
  ];

  const useCases = [
    {
      role: "Frontend Developer",
      icon: "⚙️",
      description: "Catch layout, spacing, and responsive issues before code review",
      benefits: [
        "Immediate visual feedback during development",
        "Export evidence for pull request discussions",
        "Reduce back-and-forth with design feedback",
      ],
    },
    {
      role: "Product Designer",
      icon: "🎨",
      description: "Verify implementation fidelity against Figma designs",
      benefits: [
        "Side-by-side comparison of design vs live",
        "Identify typography and color inconsistencies",
        "Document QA decisions with linked evidence",
      ],
    },
    {
      role: "QA Lead",
      icon: "✓",
      description: "Run structured visual audits across viewports and share findings",
      benefits: [
        "Multi-viewport coverage in one run",
        "Shareable JSON and Markdown reports",
        "Track audit history and remediation progress",
      ],
    },
  ];

  return (
    <div className="space-y-14 py-8 sm:py-12">
      <section className="animate-fade-in-up section-hero relative overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_45%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-8 shadow-sm sm:p-10 lg:p-12">
        <div className="absolute -left-16 top-16 h-32 w-32 rounded-full bg-cyan-100/70 blur-2xl" aria-hidden="true" />
        <div className="absolute -right-10 bottom-8 h-28 w-28 rounded-full bg-blue-100/80 blur-2xl" aria-hidden="true" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              Open-source visual QA platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              OpenDesign QA
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600">
              Audit live UI implementation quality against expected design behavior with evidence-rich runs,
              Figma comparison support, and contributor-friendly workflows.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/runs/new"
                className="rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Start New Audit
              </Link>
              <Link
                href="/fixtures/test-landing"
                className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Open Test Landing + Figma Pair
              </Link>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why teams use it</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-md bg-slate-50 px-3 py-2">Detect layout, spacing, and typography defects early</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Compare implementation against design references in one run</li>
              <li className="rounded-md bg-slate-50 px-3 py-2">Generate shareable reports for design + engineering review</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="animate-fade-in-up section-current-features space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Current Features</h2>
          <p className="mt-2 text-base text-slate-600">
            Available today in the current OpenDesign QA workflow, ready for local open-source usage.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {currentFeatures.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow"
            >
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="animate-fade-in-up section-use-cases space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Who Uses It</h2>
          <p className="mt-2 text-base text-slate-600">
            OpenDesign QA supports the entire design-to-implementation workflow.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {useCases.map((useCase) => (
            <article
              key={useCase.role}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{useCase.icon}</span>
                <h3 className="text-lg font-semibold text-slate-900">{useCase.role}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600">{useCase.description}</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600">
                {useCase.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="animate-fade-in-up section-upcoming-features rounded-2xl border border-slate-200 bg-slate-900 p-8 text-slate-100 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Roadmap</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Upcoming Features</h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              This roadmap reflects in-progress priorities for the open-source project. No pricing gates,
              no lock-in, and no paid-only feature framing.
            </p>
          </div>

          <ul className="space-y-3">
            {upcomingFeatures.map((item) => (
              <li key={item} className="rounded-md border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="animate-fade-in-up section-contributing rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Join the Community</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Contribute to OpenDesign QA</h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              OpenDesign QA is actively maintained and welcomes contributions. Whether you're building new rules,
              improving the capture pipeline, or enhancing the UI, your work directly impacts the entire open-source community.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://github.com/opendesign-qa/opendesign-qa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.544 2.914 1.183.092-.916.35-1.544.636-1.9-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.578.688.48C19.138 20.195 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
              <a
                href="https://github.com/opendesign-qa/opendesign-qa/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Contributing Guide
              </a>
            </div>
          </div>
          <aside className="rounded-xl border border-blue-200 bg-white/70 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Quick start</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="rounded-md bg-blue-50 px-3 py-2">Fork the repository</li>
              <li className="rounded-md bg-blue-50 px-3 py-2">Check open issues and PRs</li>
              <li className="rounded-md bg-blue-50 px-3 py-2">Review CONTRIBUTING.md</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="animate-fade-in-up section-commitment rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Open-Source Commitment</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          OpenDesign QA is community-first and transparent. The landing page intentionally excludes pricing
          information and focuses on product capability, roadmap clarity, and contribution-driven progress.
        </p>
      </section>
    </div>
  );
}
