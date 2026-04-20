import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaunchProgress } from "@/components/launch-progress";

describe("LaunchProgress", () => {
  it("renders all step labels for snapshot path", () => {
    render(
      <LaunchProgress state="creating" onRetry={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Creating sandbox")).toBeInTheDocument();
    expect(screen.getByText("Configuring environment")).toBeInTheDocument();
    expect(screen.getByText("Uploading skill")).toBeInTheDocument();
    expect(screen.getByText("Starting agent")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders fallback step labels when usedSnapshot is false", () => {
    const { container } = render(
      <LaunchProgress state="creating" onRetry={() => {}} onCancel={() => {}} usedSnapshot={false} />,
    );
    expect(container.textContent).toContain("Creating sandbox");
    expect(container.textContent).toContain("Installing Hermes Agent");
    expect(container.textContent).toContain("Configuring environment");
    expect(container.textContent).toContain("Uploading skill");
    expect(container.textContent).toContain("Starting agent");
    expect(container.textContent).toContain("Ready");
  });

  it("shows cancel button during normal progress", () => {
    render(
      <LaunchProgress state="uploading" onRetry={() => {}} onCancel={() => {}} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.some((b) => b.textContent === "Cancel")).toBe(true);
  });

  it("shows retry and cancel on error", () => {
    render(
      <LaunchProgress state="error" error="Connection failed" onRetry={() => {}} onCancel={() => {}} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.some((b) => b.textContent === "Retry")).toBe(true);
    expect(buttons.some((b) => b.textContent === "Cancel")).toBe(true);
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  it("shows Launch failed and error message", () => {
    const { container } = render(
      <LaunchProgress state="error" error="Sandbox creation timeout" onRetry={() => {}} onCancel={() => {}} />,
    );
    expect(container.textContent).toContain("Launch failed");
    expect(container.textContent).toContain("Sandbox creation timeout");
  });

  it("shows unknown error when error is empty", () => {
    render(
      <LaunchProgress state="error" onRetry={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Unknown error")).toBeInTheDocument();
  });
});
