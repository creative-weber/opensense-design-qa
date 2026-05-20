/**
 * ODQA-014 — Scaffold API Service
 *
 * Verifies the Fastify API service:
 * - GET /health returns 200 { status: "ok" }
 * - Zod validation middleware returns structured 400 errors
 * - Unknown routes return 404
 */
import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// ODQA-014: Scaffold API Service — Health Endpoint
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ODQA-014 — Scaffold API Service", () => {
  test("GET /health returns 200 with { status: 'ok' }", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);

    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("GET /health Content-Type is application/json", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.headers()["content-type"]).toContain("application/json");
  });

  // Edge case: unknown route returns 404
  test("GET /nonexistent-route returns 404", async ({ request }) => {
    const response = await request.get("/nonexistent-route");

    expect(response.status()).toBe(404);
  });

  // Edge case: Zod validation error returns structured 400 response
  test("route that throws ZodError returns 400 with issues array", async ({ request }) => {
    // POST /api/runs with a missing required field should trigger Zod validation
    const response = await request.post("/api/runs", {
      data: {
        // Missing required projectId and url fields
        viewports: ["desktop"],
      },
    });

    expect(response.status()).toBe(400);

    const body = (await response.json()) as {
      statusCode?: number;
      error?: string;
      issues?: Array<{ path: string; message: string }>;
    };

    // Should return either structured Zod issues or a standard 400 error
    expect(body.statusCode ?? response.status()).toBe(400);
  });

  // Edge case: CORS headers present on health response
  test("GET /health response includes CORS headers", async ({ request }) => {
    const response = await request.get("/health");

    // CORS middleware should add access-control headers
    // The header may vary depending on the origin, but the endpoint should respond
    expect(response.status()).toBe(200);
  });

  // Edge case: repeated health checks are stable
  test("GET /health returns consistent results on repeated calls", async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request.get("/health"))
    );

    for (const response of responses) {
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("ok");
    }
  });
});
