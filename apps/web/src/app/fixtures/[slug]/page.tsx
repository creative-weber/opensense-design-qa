import { notFound } from "next/navigation";

type FixtureSlug =
  | "alignment-drift"
  | "clean"
  | "color-mismatch"
  | "contrast"
  | "contrast-large-text"
  | "overflow"
  | "overlap"
  | "single-child"
  | "spacing-inconsistency"
  | "typography-inconsistency";

const supportedFixtures = new Set<FixtureSlug>([
  "alignment-drift",
  "clean",
  "color-mismatch",
  "contrast",
  "contrast-large-text",
  "overflow",
  "overlap",
  "single-child",
  "spacing-inconsistency",
  "typography-inconsistency",
]);

function renderFixture(slug: FixtureSlug) {
  switch (slug) {
    case "overflow":
      return (
        <section style={{ width: 320, overflow: "hidden", border: "1px solid #cbd5e1", padding: 16 }}>
          <div className="fixture-overflow__content" style={{ width: 720, whiteSpace: "nowrap", color: "#0f172a" }}>
            This content intentionally overflows the clipping container to exercise overflow detection.
          </div>
        </section>
      );
    case "overlap":
      return (
        <section style={{ position: "relative", minHeight: 220 }}>
          <article className="fixture-overlap__card--primary" style={{ position: "absolute", inset: "16px auto auto 16px", width: 240, padding: 24, background: "#e2e8f0" }}>
            Primary card
          </article>
          <article className="fixture-overlap__card--secondary" style={{ position: "absolute", inset: "56px auto auto 120px", width: 240, padding: 24, background: "#cbd5e1" }}>
            Secondary card
          </article>
        </section>
      );
    case "alignment-drift":
      return (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ padding: 16, background: "#f8fafc" }}>Aligned card</div>
          <div className="fixture-alignment__item--drifted" style={{ marginLeft: 36, padding: 16, background: "#f8fafc" }}>
            Drifted card
          </div>
          <div style={{ padding: 16, background: "#f8fafc" }}>Aligned card</div>
        </section>
      );
    case "single-child":
      return (
        <section>
          <div style={{ padding: 16, background: "#f8fafc" }}>Single child group</div>
        </section>
      );
    case "spacing-inconsistency":
      return (
        <section style={{ display: "grid" }}>
          <div style={{ marginBottom: 16, padding: 16, background: "#f8fafc" }}>Rhythm 1</div>
          <div className="fixture-spacing__item--outlier" style={{ marginBottom: 36, padding: 16, background: "#f8fafc" }}>
            Rhythm outlier
          </div>
          <div style={{ padding: 16, background: "#f8fafc" }}>Rhythm 2</div>
        </section>
      );
    case "typography-inconsistency":
      return (
        <section style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>Body copy</p>
          <p className="fixture-typography__outlier" style={{ fontSize: 19, lineHeight: 1.5 }}>Off-scale body copy</p>
          <h2 style={{ fontSize: 24, lineHeight: 1.2 }}>Heading</h2>
        </section>
      );
    case "color-mismatch":
      return (
        <section style={{ display: "grid", gap: 12 }}>
          <p style={{ color: "#334155" }}>Default body color</p>
          <p className="fixture-color__outlier" style={{ color: "#be185d" }}>Unexpected accent text color</p>
          <a href="/runs/new" style={{ color: "#4f46e5" }}>Navigation link remains exempt</a>
        </section>
      );
    case "contrast":
      return (
        <section style={{ background: "#ffffff", padding: 24 }}>
          <p className="fixture-contrast__copy" style={{ color: "#8f8f8f" }}>
            This paragraph intentionally fails normal-text contrast guidance.
          </p>
        </section>
      );
    case "contrast-large-text":
      return (
        <section style={{ background: "#ffffff", padding: 24 }}>
          <p className="fixture-contrast-large__headline" style={{ color: "#767676", fontSize: 28, fontWeight: 700 }}>
            This headline intentionally fails large-text contrast guidance.
          </p>
        </section>
      );
    case "clean":
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: 16, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a" }}>Clean card one</div>
          <div style={{ padding: 16, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a" }}>Clean card two</div>
          <div style={{ padding: 16, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a" }}>Clean card three</div>
        </section>
      );
  }
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!supportedFixtures.has(slug as FixtureSlug)) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-16 text-slate-900">
      <header className="flex flex-col gap-3">
        <span className="text-sm font-medium text-slate-500">Fixture</span>
        <h1 className="text-3xl font-bold tracking-tight">{slug}</h1>
        <p className="max-w-2xl text-slate-600">
          Purpose-built visual QA fixture for the OpenDesign QA audit pipeline.
        </p>
      </header>
      {renderFixture(slug as FixtureSlug)}
    </main>
  );
}