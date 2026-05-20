import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

// Mock next/link since we're not in a Next.js runtime
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe("Nav", () => {
  it("renders the brand name", () => {
    render(<Nav />);
    expect(screen.getByText("OpenDesign QA")).toBeInTheDocument();
  });

  it("renders a link to new audit", () => {
    render(<Nav />);
    const link = screen.getByRole("link", { name: /new audit/i });
    expect(link).toHaveAttribute("href", "/runs/new");
  });

  it("renders the brand as a link to home", () => {
    render(<Nav />);
    const brandLink = screen.getByRole("link", { name: "OpenDesign QA" });
    expect(brandLink).toHaveAttribute("href", "/");
  });
});
