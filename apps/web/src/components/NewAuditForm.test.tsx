import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, beforeEach, afterEach, expect, it, vi } from "vitest";
import { NewAuditForm } from "./NewAuditForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NewAuditForm />
    </QueryClientProvider>
  );
}

function createJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("NewAuditForm", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a validation message for an invalid URL without calling the API", async () => {
    const fetchMock = vi.mocked(fetch);
    renderForm();

    fireEvent.change(screen.getByLabelText(/website url/i), {
      target: { value: "not-a-url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start audit/i }));

    expect(
      await screen.findByText(/URL must use http or https protocol/i)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a project, submits the run, and navigates to the run page", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ id: "11111111-1111-1111-1111-111111111111" }, true, 201))
      .mockResolvedValueOnce(createJsonResponse({ id: "run-123" }, true, 201));

    renderForm();

    fireEvent.change(screen.getByLabelText(/website url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start audit/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3001/api/projects",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3001/api/runs",
      expect.objectContaining({ method: "POST" })
    );

    const secondCall = fetchMock.mock.calls[1];
    const secondRequest = secondCall?.[1] as RequestInit | undefined;
    expect(secondRequest).toBeDefined();
    expect(JSON.parse(String(secondRequest?.body))).toEqual({
      projectId: "11111111-1111-1111-1111-111111111111",
      url: "https://example.com",
      viewports: ["desktop"],
      figmaFrameUrl: null,
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/runs/run-123");
    });
  });

  it("disables submission while the request is in flight", async () => {
    let resolveProject: ((value: Response) => void) | undefined;
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveProject = resolve;
        })
    );

    renderForm();

    fireEvent.change(screen.getByLabelText(/website url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start audit/i }));

    expect(await screen.findByRole("button", { name: /starting audit/i })).toBeDisabled();

    resolveProject?.(createJsonResponse({ id: "11111111-1111-1111-1111-111111111111" }, true, 201));
    fetchMock.mockResolvedValueOnce(createJsonResponse({ id: "run-123" }, true, 201));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/runs/run-123");
    });
  });
});