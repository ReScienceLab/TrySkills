import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SkillPreview } from "@/components/skill-preview";

describe("SkillPreview", () => {
  const defaultProps = {
    meta: {
      name: "frontend-design",
      description: "Build beautiful web interfaces with best practices",
      author: "Anthropic",
      icon: "\uD83C\uDFA8",
      version: "2.1.0",
    },
    body: "# frontend-design\n\nDetailed documentation about the skill.",
    owner: "anthropics",
    repo: "skills",
    skillName: "frontend-design",
    onLaunch: () => {},
  };

  it("renders skill name as heading", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    const heading = container.querySelector("h1");
    expect(heading?.textContent).toContain("frontend-design");
  });

  it("renders skill description", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    expect(container.textContent).toContain("Build beautiful web interfaces with best practices");
  });

  it("renders author/repo info", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    expect(container.textContent).toContain("anthropics/skills");
  });

  it("renders version when present", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    expect(container.textContent).toContain("v2.1.0");
  });

  it("renders skill icon", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    expect(container.textContent).toContain("\uD83C\uDFA8");
  });

  it("renders body documentation", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    expect(container.textContent).toContain("Detailed documentation about the skill");
  });

  it("renders configure button", () => {
    const { container } = render(<SkillPreview {...defaultProps} />);
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Configure & Launch");
  });

  it("uses default icon when none provided", () => {
    const { container } = render(
      <SkillPreview {...defaultProps} meta={{ ...defaultProps.meta, icon: undefined }} />,
    );
    expect(container.textContent).toContain("\u26A1");
  });

  it("truncates long body with character count", () => {
    const longBody = "A".repeat(3000);
    const { container } = render(<SkillPreview {...defaultProps} body={longBody} />);
    expect(container.textContent).toContain("3K chars");
  });

  it("does not render version when missing", () => {
    const { container } = render(
      <SkillPreview {...defaultProps} meta={{ ...defaultProps.meta, version: undefined }} />,
    );
    expect(container.textContent).not.toContain("v2.1.0");
  });
});
