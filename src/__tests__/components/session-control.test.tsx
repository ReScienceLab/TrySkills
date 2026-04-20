import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SessionControl } from "@/components/session-control";

describe("SessionControl", () => {
  const mockOnStop = vi.fn();
  const defaultProps = {
    webuiUrl: "https://preview.daytona.io/sb-123?token=abc",
    startedAt: Date.now(),
    onStop: mockOnStop,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders running status", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    expect(container.textContent).toContain("Sandbox Running");
  });

  it("renders Open Hermes WebUI button", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const webuiBtn = Array.from(buttons).find((b) => b.textContent?.includes("Open Hermes WebUI"));
    expect(webuiBtn).toBeDefined();
  });

  it("renders stop button", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const stopBtn = Array.from(buttons).find((b) => b.textContent?.includes("Stop"));
    expect(stopBtn).toBeDefined();
  });

  it("calls onStop when stop button is clicked", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const stopBtn = Array.from(buttons).find((b) => b.textContent?.includes("Stop"))!;
    fireEvent.click(stopBtn);
    expect(mockOnStop).toHaveBeenCalledTimes(1);
  });

  it("shows auto-stop notice", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    expect(container.textContent).toContain("auto-stops after 30 minutes");
  });

  it("shows cost indicator", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    expect(container.textContent).toContain("Cost:");
    expect(container.textContent).toContain("$0.000");
  });

  it("opens webui URL in new window", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<SessionControl {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const webuiBtn = Array.from(buttons).find((b) => b.textContent?.includes("Open Hermes WebUI"))!;
    fireEvent.click(webuiBtn);
    expect(openSpy).toHaveBeenCalledWith(
      "https://preview.daytona.io/sb-123?token=abc",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("displays timer starting at 0:00", () => {
    const { container } = render(<SessionControl {...defaultProps} startedAt={Date.now()} />);
    expect(container.textContent).toContain("0:00");
  });

  it("renders Try Another Skill button when onTryAnother provided", () => {
    const mockTryAnother = vi.fn();
    const { container } = render(
      <SessionControl {...defaultProps} onTryAnother={mockTryAnother} />,
    );
    const buttons = container.querySelectorAll("button");
    const tryBtn = Array.from(buttons).find((b) => b.textContent?.includes("Try Another Skill"));
    expect(tryBtn).toBeDefined();
  });

  it("does not render Try Another Skill button when onTryAnother not provided", () => {
    const { container } = render(<SessionControl {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const tryBtn = Array.from(buttons).find((b) => b.textContent?.includes("Try Another Skill"));
    expect(tryBtn).toBeUndefined();
  });

  it("calls onTryAnother when Try Another Skill is clicked", () => {
    const mockTryAnother = vi.fn();
    const { container } = render(
      <SessionControl {...defaultProps} onTryAnother={mockTryAnother} />,
    );
    const buttons = container.querySelectorAll("button");
    const tryBtn = Array.from(buttons).find((b) => b.textContent?.includes("Try Another Skill"))!;
    fireEvent.click(tryBtn);
    expect(mockTryAnother).toHaveBeenCalledTimes(1);
  });
});
