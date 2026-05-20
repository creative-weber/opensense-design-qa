"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CreateRunSchema, type CreateRunRequest } from "@opendesign-qa/contracts";

const VIEWPORT_OPTIONS = [
  { id: "desktop", label: "Desktop (1440x900)" },
  { id: "tablet", label: "Tablet (768x1024)" },
  { id: "mobile", label: "Mobile (390x844)" },
] as const;

const FORM_SCHEMA = CreateRunSchema.omit({ projectId: true });
const DEFAULT_PROJECT_NAME = "Quick Audit";

type FormValues = Omit<CreateRunRequest, "projectId">;

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const body = (await response.json()) as {
      message?: string;
      issues?: Array<{ path?: string; message?: string }>;
    };

    if (body.issues?.[0]?.message) {
      return body.issues[0].message;
    }

    return body.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function createProject() {
  const response = await fetch(`${getApiBaseUrl()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DEFAULT_PROJECT_NAME }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to create project"));
  }

  const project = (await response.json()) as { id: string };
  return project.id;
}

async function createRun(data: CreateRunRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to create audit run"));
  }

  return (await response.json()) as { id: string };
}

export function NewAuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [selectedViewports, setSelectedViewports] = useState<string[]>(["desktop"]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const {
    mutate: submitRun,
    isPending: isSubmitting,
    error: submitError,
  } = useMutation({
    mutationFn: async (data: FormValues) => {
      const projectId = await createProject();
      return createRun({ ...data, projectId });
    },
    onSuccess: (data) => {
      router.push(`/runs/${data.id}`);
    },
  });

  const clearValidationError = useCallback((field: string) => {
    setValidationErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleViewportToggle = useCallback((viewport: string) => {
    setSelectedViewports((prev) => {
      if (prev.includes(viewport)) {
        if (prev.length > 1) {
          return prev.filter((v) => v !== viewport);
        }
        return prev;
      }

      if (prev.length < 3) {
        return [...prev, viewport];
      }

      return prev;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = FORM_SCHEMA.safeParse({
        url,
        viewports: selectedViewports,
        figmaFrameUrl: figmaUrl.trim() || null,
      });

      if (!result.success) {
        const zodErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          zodErrors[path] = issue.message;
        });
        setValidationErrors(zodErrors);
        return;
      }

      setValidationErrors({});
      submitRun(result.data);
    },
    [url, figmaUrl, selectedViewports, submitRun]
  );

  const isLoading = isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-slate-900 mb-2">
          Website URL
        </label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            clearValidationError("url");
          }}
          placeholder="https://example.com"
          disabled={isLoading}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {validationErrors.url && (
          <p className="mt-1 text-sm text-red-600">{validationErrors.url}</p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-900 mb-3">
          Capture viewports
        </legend>
        <div className="space-y-3">
          {VIEWPORT_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedViewports.includes(option.id)}
                onChange={() => {
                  handleViewportToggle(option.id);
                  clearValidationError("viewports");
                }}
                disabled={isLoading}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
        {validationErrors.viewports && (
          <p className="mt-2 text-sm text-red-600">{validationErrors.viewports}</p>
        )}
      </fieldset>

      <div>
        <label htmlFor="figma-url" className="block text-sm font-medium text-slate-900 mb-2">
          Figma Frame URL <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="figma-url"
          type="text"
          value={figmaUrl}
          onChange={(e) => {
            setFigmaUrl(e.target.value);
            clearValidationError("figmaFrameUrl");
          }}
          placeholder="https://figma.com/file/..."
          disabled={isLoading}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {validationErrors.figmaFrameUrl && (
          <p className="mt-1 text-sm text-red-600">{validationErrors.figmaFrameUrl}</p>
        )}
      </div>

      {submitError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{(submitError as Error).message}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Starting audit...
          </span>
        ) : (
          "Start Audit"
        )}
      </button>
    </form>
  );
}
