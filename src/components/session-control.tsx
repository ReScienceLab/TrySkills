"use client";

import { useState, useEffect } from "react";

export function SessionControl({
  webuiUrl,
  startedAt,
  onStop,
}: {
  webuiUrl: string;
  startedAt: number;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const openWebUI = () => {
    window.open(webuiUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="animate-fade-in">
      <div className="card p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-3 h-3 rounded-full bg-[var(--success)] animate-pulse" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Sandbox Running
          </h2>
          <span className="ml-auto font-mono text-sm text-[var(--text-muted)]">
            {formatTime(elapsed)}
          </span>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Hermes Agent is running with your skill loaded. Use the WebUI to interact with the agent.
        </p>

        <div className="space-y-3 mb-8">
          <button
            onClick={openWebUI}
            className="w-full py-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-lg transition-all duration-200 hover:shadow-xl hover:shadow-[var(--accent)]/20 active:scale-[0.98] shadow-sm flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open Hermes WebUI
          </button>

          <button
            onClick={onStop}
            className="w-full py-3 rounded-xl bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 font-medium text-sm transition-all"
          >
            Stop &amp; Cleanup
          </button>
        </div>

        <div className="text-xs text-[var(--text-muted)] text-center">
          Sandbox will auto-stop after 60 minutes to prevent resource consumption.
        </div>
      </div>
    </div>
  );
}
