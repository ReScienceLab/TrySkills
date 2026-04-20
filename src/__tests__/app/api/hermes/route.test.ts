import { describe, it, expect } from "vitest";

describe("hermes proxy host validation", () => {
  const ALLOWED_HOST_PATTERN = /^\d+-[a-z0-9]+\.daytonaproxy\d*\.net$/;

  function isAllowedHost(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return ALLOWED_HOST_PATTERN.test(hostname);
    } catch {
      return false;
    }
  }

  it("allows valid Daytona signed preview URLs", () => {
    expect(isAllowedHost("https://8787-abc123def456.daytonaproxy01.net")).toBe(true);
    expect(isAllowedHost("https://8787-gk1dusgvfsqnktjr.daytonaproxy01.net")).toBe(true);
    expect(isAllowedHost("https://3000-xyz789.daytonaproxy.net")).toBe(true);
    expect(isAllowedHost("https://8787-abc123.daytonaproxy02.net")).toBe(true);
  });

  it("blocks arbitrary external URLs", () => {
    expect(isAllowedHost("https://evil.com")).toBe(false);
    expect(isAllowedHost("https://google.com")).toBe(false);
    expect(isAllowedHost("https://internal-api.company.com")).toBe(false);
    expect(isAllowedHost("http://localhost:3000")).toBe(false);
    expect(isAllowedHost("http://127.0.0.1:8787")).toBe(false);
  });

  it("blocks URLs that partially match but are not Daytona proxies", () => {
    expect(isAllowedHost("https://daytonaproxy01.net")).toBe(false);
    expect(isAllowedHost("https://evil.daytonaproxy01.net")).toBe(false);
  });

  it("handles invalid URLs gracefully", () => {
    expect(isAllowedHost("not-a-url")).toBe(false);
    expect(isAllowedHost("")).toBe(false);
  });
});
