"use client";

import { useState, useEffect } from "react";

const COST_PER_HOUR = 0.167; // 2 vCPU ($0.1008) + 4GiB RAM ($0.0648) + 10GiB disk ($0.00108)
const AUTO_STOP_MINUTES = 15;

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

  const cost = ((elapsed / 3600) * COST_PER_HOUR).toFixed(3);

  const openWebUI = () => {
    window.open(webuiUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="animate-fade-in">
      <div className="border border-white/20 bg-black/40 backdrop-blur-sm p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-lg font-semibold text-white/90">
            Sandbox Running
          </h2>
          <span className="ml-auto font-mono text-sm text-white/40">
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Cost + Auto-stop bar */}
        <div className="flex items-center justify-between mb-6 px-3 py-2 bg-white/[0.03] border border-white/8 rounded text-xs">
          <div className="flex items-center gap-3">
            <span className="text-white/40">
              Cost: <span className="text-white/70 font-mono">${cost}</span>
            </span>
            <span className="text-white/15">|</span>
            <span className="text-white/40">
              2 vCPU + 4GB RAM
            </span>
          </div>
          <span className="text-white/30 font-mono">
            idle-stop: {AUTO_STOP_MINUTES}min
          </span>
        </div>

        <p className="text-sm text-white/50 mb-6">
          Hermes Agent is running with your skill loaded. Use the WebUI to interact with the agent.
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={openWebUI}
            className="w-full py-4 bg-white text-black font-semibold text-lg hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open Hermes WebUI
          </button>

          <button
            onClick={onStop}
            className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-all"
          >
            Stop &amp; Cleanup
          </button>
        </div>

        <div className="text-xs text-white/25 text-center">
          Sandbox auto-stops after {AUTO_STOP_MINUTES} minutes if you close this page.
        </div>
      </div>
    </div>
  );
}
