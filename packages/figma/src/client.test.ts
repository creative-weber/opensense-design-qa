import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFile, getFrameImage, FigmaClientError, FigmaRateLimitError } from "./client.ts";

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

function makeImageResponse(data: Uint8Array, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(""),
    arrayBuffer: () => Promise.resolve(data.buffer),
  } as unknown as Response;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  process.env["FIGMA_ACCESS_TOKEN"] = "test-token-xyz";
});

afterEach(() => {
  delete process.env["FIGMA_ACCESS_TOKEN"];
});

// ─── getFile ──────────────────────────────────────────────────────────────────

describe("getFile", () => {
  it("calls the Figma files API with the correct URL and token", async () => {
    const fakeDocument = { id: "0:1", name: "Root", type: "DOCUMENT", children: [] };
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ document: fakeDocument, name: "My Design", lastModified: "2026-01-01", version: "1" })
    );

    const result = await getFile("abc123");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.figma.com/v1/files/abc123");
    expect((calledInit as { headers: Record<string, string> }).headers["X-Figma-Token"]).toBe("test-token-xyz");
    expect(result.name).toBe("My Design");
    expect(result.document.id).toBe("0:1");
  });

  it("throws FigmaClientError when FIGMA_ACCESS_TOKEN is not set", async () => {
    delete process.env["FIGMA_ACCESS_TOKEN"];
    await expect(getFile("abc123")).rejects.toThrow(FigmaClientError);
    await expect(getFile("abc123")).rejects.toThrow("FIGMA_ACCESS_TOKEN");
  });

  it("throws FigmaClientError on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ message: "Not found" }, 404));
    const error = await getFile("bad-key").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FigmaClientError);
    expect((error as FigmaClientError).message).toContain("404");
  });

  it("retries on 429 and succeeds on the next attempt", async () => {
    const fakeFile = { document: { id: "0:1", name: "Root", type: "DOCUMENT" }, name: "Retried", lastModified: "", version: "1" };
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({}, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(makeJsonResponse(fakeFile));

    const result = await getFile("abc123");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.name).toBe("Retried");
  });

  it("throws FigmaRateLimitError after exhausting all retries", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}, 429, { "retry-after": "0" }));
    await expect(getFile("abc123")).rejects.toThrow(FigmaRateLimitError);
  }, 10_000);
});

// ─── getFrameImage ────────────────────────────────────────────────────────────

describe("getFrameImage", () => {
  it("calls images API with correct parameters and returns buffer", async () => {
    const imageUrl = "https://figma-cdn.com/render/frame.png";
    const fakePixels = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ images: { "1:2": imageUrl } }))
      .mockResolvedValueOnce(makeImageResponse(fakePixels));

    const result = await getFrameImage("fileKey1", "1:2");

    // First call: images API
    const [firstUrl, firstInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toContain("https://api.figma.com/v1/images/fileKey1");
    expect(firstUrl).toContain("scale=2");
    expect(firstUrl).toContain("format=png");
    expect((firstInit as { headers: Record<string, string> }).headers["X-Figma-Token"]).toBe("test-token-xyz");

    // Second call: download the image
    expect(mockFetch.mock.calls[1]?.[0]).toBe(imageUrl);

    expect(result.imageUrl).toBe(imageUrl);
    expect(result.imageBuffer).toBeInstanceOf(Buffer);
  });

  it("accepts URL-encoded node IDs and falls back to decoded key", async () => {
    const imageUrl = "https://figma-cdn.com/render/frame.png";
    const fakePixels = new Uint8Array([1, 2, 3]);

    // API returns key with colon (decoded form)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ images: { "1:2": imageUrl } }))
      .mockResolvedValueOnce(makeImageResponse(fakePixels));

    // Pass URL-encoded node ID
    const result = await getFrameImage("fileKey1", "1:2");
    expect(result.imageUrl).toBe(imageUrl);
  });

  it("throws FigmaClientError when images API returns an error field", async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ err: "Invalid node" }));
    const error = await getFrameImage("fileKey1", "1:2").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FigmaClientError);
    expect((error as FigmaClientError).message).toContain("Invalid node");
  });

  it("throws FigmaClientError when no image URL is returned for the node", async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ images: {} }));
    const error = await getFrameImage("fileKey1", "1:2").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FigmaClientError);
    expect((error as FigmaClientError).message).toContain("No image URL");
  });

  it("throws FigmaClientError when image download fails", async () => {
    const imageUrl = "https://figma-cdn.com/render/frame.png";
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ images: { "1:2": imageUrl } }))
      .mockResolvedValueOnce(makeImageResponse(new Uint8Array(), 503));

    const error = await getFrameImage("fileKey1", "1:2").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FigmaClientError);
    expect((error as FigmaClientError).message).toContain("503");
  });

  it("throws FigmaClientError when FIGMA_ACCESS_TOKEN is not set", async () => {
    delete process.env["FIGMA_ACCESS_TOKEN"];
    await expect(getFrameImage("fileKey1", "1:2")).rejects.toThrow(FigmaClientError);
  });
});
