import { chromium, type Page } from "playwright";

// ─── Domain types ─────────────────────────────────────────────────────────────

export type WaitStrategyType =
  | "networkidle"
  | "domcontentloaded"
  | "custom-selector-present"
  | "fixed-delay";

export interface WaitStrategy {
  type: WaitStrategyType;
  /** CSS selector (for custom-selector-present strategy) */
  selector?: string;
  /** Milliseconds to wait (for fixed-delay strategy) */
  delayMs?: number;
}

export interface CaptureConfig {
  /** Ordered list of wait strategies applied before screenshot. */
  waitStrategies?: WaitStrategy[];
}

/** Built-in viewport presets */
export const VIEWPORT_PRESETS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

export interface ViewportDimensions {
  width: number;
  height: number;
}

// ─── DOM Snapshot ─────────────────────────────────────────────────────────────

export interface DomSnapshot {
  selector: string;
  tagName: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  computedFontSize: string;
  computedColor: string;
  computedBackgroundColor: string;
  overflow: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

// ─── Capture result ───────────────────────────────────────────────────────────

export interface CaptureResult {
  screenshotBuffer: Buffer;
  viewport: ViewportPreset | ViewportDimensions;
  url: string;
  capturedAt: Date;
  domSnapshot: DomSnapshot[];
}

// ─── Capture error ────────────────────────────────────────────────────────────

export class CaptureError extends Error {
  public readonly code: "NON_200_RESPONSE" | "NAVIGATION_TIMEOUT" | "UNKNOWN";
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: "NON_200_RESPONSE" | "NAVIGATION_TIMEOUT" | "UNKNOWN",
    statusCode?: number
  ) {
    super(message);
    this.name = "CaptureError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function resolveViewport(
  viewport: ViewportPreset | ViewportDimensions
): ViewportDimensions {
  if (typeof viewport === "string") {
    return VIEWPORT_PRESETS[viewport];
  }
  return viewport;
}

async function applyWaitStrategies(
  page: Page,
  waitStrategies?: WaitStrategy[]
): Promise<void> {
  const strategies = waitStrategies && waitStrategies.length > 0
    ? waitStrategies
    : [{ type: "networkidle" as const }];

  for (const strategy of strategies) {
    if (strategy.type === "networkidle") {
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      continue;
    }

    if (strategy.type === "domcontentloaded") {
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      continue;
    }

    if (strategy.type === "custom-selector-present") {
      if (!strategy.selector) {
        throw new CaptureError(
          "custom-selector-present requires selector",
          "UNKNOWN"
        );
      }
      await page.waitForSelector(strategy.selector, {
        state: "visible",
        timeout: 15000,
      });
      continue;
    }

    if (strategy.type === "fixed-delay") {
      await page.waitForTimeout(strategy.delayMs ?? 0);
      continue;
    }
  }
}

// ─── Main capture function ───────────────────────────────────────────────────

export async function capture(
  url: string,
  viewport: ViewportPreset | ViewportDimensions,
  config?: CaptureConfig
): Promise<CaptureResult> {
  const resolvedViewport = resolveViewport(viewport);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: resolvedViewport });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    if (!response || response.status() >= 400) {
      throw new CaptureError(
        `Navigation returned non-200 response for ${url}`,
        "NON_200_RESPONSE",
        response?.status()
      );
    }

    await applyWaitStrategies(page, config?.waitStrategies);

    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });

    const domSnapshot = await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        document: { querySelectorAll: (selector: string) => unknown[] };
        getComputedStyle: (node: unknown) => {
          fontSize: string;
          color: string;
          backgroundColor: string;
          overflow: string;
        };
      };
      const elements = Array.from(browserGlobal.document.querySelectorAll("*")).slice(0, 1500) as Array<{
        id?: string;
        tagName: string;
        classList?: { length: number; [Symbol.iterator]: () => IterableIterator<string> };
        getBoundingClientRect: () => { x: number; y: number; width: number; height: number };
        scrollWidth: number;
        clientWidth: number;
        scrollHeight: number;
        clientHeight: number;
      }>;

      return elements.map((el) => {
        const rect = el.getBoundingClientRect();
        const computed = browserGlobal.getComputedStyle(el);
        return {
          selector: el.id
            ? `#${el.id}`
            : `${el.tagName.toLowerCase()}${el.classList && el.classList.length ? `.${Array.from(el.classList).join(".")}` : ""}`,
          tagName: el.tagName.toLowerCase(),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          computedFontSize: computed.fontSize,
          computedColor: computed.color,
          computedBackgroundColor: computed.backgroundColor,
          overflow: computed.overflow,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
    });

    return {
      screenshotBuffer,
      viewport,
      url,
      capturedAt: new Date(),
      domSnapshot,
    };
  } catch (error) {
    if (error instanceof CaptureError) {
      throw error;
    }

    if (
      error instanceof Error &&
      (error.name.includes("Timeout") || error.message.toLowerCase().includes("timeout"))
    ) {
      throw new CaptureError(
        `Navigation timeout for ${url}`,
        "NAVIGATION_TIMEOUT"
      );
    }

    throw new CaptureError(
      error instanceof Error ? error.message : String(error),
      "UNKNOWN"
    );
  } finally {
    await context.close();
    await browser.close();
  }
}
