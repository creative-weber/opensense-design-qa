import Link from "next/link";
import { NewAuditForm } from "@/components/NewAuditForm";

export default function NewAuditPage() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Back to home
        </Link>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Start New Audit
      </h1>
      <p className="text-slate-600">
        Configure your audit settings below to begin a new visual design QA run.
      </p>
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Quick test pair</p>
        <p className="mt-2 font-mono">Website URL: http://localhost:3000/fixtures/test-landing</p>
        <p className="mt-1 font-mono">Figma URL: http://localhost:3000/figma/test-landing-frame.svg</p>
      </section>
      <NewAuditForm />
    </div>
  );
}
