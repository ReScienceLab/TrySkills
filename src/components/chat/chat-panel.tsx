"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { useChat, type ChatMessage, type ToolCall, type ApprovalRequest } from "./use-chat";
import { respondApproval } from "@/lib/sandbox/hermes-api";

function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="my-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {tool.status === "running" ? (
          <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
        ) : tool.status === "error" ? (
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        )}
        <span className="text-white/60 font-mono">{tool.name}</span>
        {tool.duration != null && (
          <span className="text-white/30 ml-auto">{(tool.duration / 1000).toFixed(1)}s</span>
        )}
        {tool.status === "running" && (
          <span className="text-blue-400/60 ml-auto">running...</span>
        )}
      </div>
      {expanded && tool.args && (
        <pre className="mt-1 text-white/30 text-[10px] overflow-x-auto">
          {JSON.stringify(tool.args, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  webuiBaseUrl,
  onDismiss,
}: {
  approval: ApprovalRequest;
  webuiBaseUrl: string;
  onDismiss: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const handleApprove = async (choice: "once" | "session" | "always" | "deny") => {
    setError(null);
    try {
      await respondApproval(webuiBaseUrl, approval.sessionId, choice);
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send approval");
    }
  };

  return (
    <div className="mx-4 my-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded">
      <div className="text-sm text-amber-400 font-medium mb-1">Command Approval Required</div>
      <pre className="text-xs text-white/70 bg-black/30 p-2 rounded mb-3 overflow-x-auto">
        {approval.command}
      </pre>
      {approval.description && (
        <p className="text-xs text-white/40 mb-3">{approval.description}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 mb-2">{error} -- try again</p>
      )}
      <div className="flex gap-2">
        <button onClick={() => handleApprove("once")} className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30 rounded transition-all">
          Allow once
        </button>
        <button onClick={() => handleApprove("session")} className="px-3 py-1.5 bg-white/5 text-white/50 text-xs hover:bg-white/10 rounded transition-all">
          Allow for session
        </button>
        <button onClick={() => handleApprove("deny")} className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 rounded transition-all">
          Deny
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-white/10 rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-sm text-white/90 whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {msg.reasoning && (
        <details className="mb-2">
          <summary className="text-xs text-amber-400/50 cursor-pointer hover:text-amber-400/70">
            Thinking...
          </summary>
          <div className="text-xs text-white/25 mt-1 pl-3 border-l border-white/10 whitespace-pre-wrap">
            {msg.reasoning}
          </div>
        </details>
      )}
      {msg.toolCalls?.map((tc, i) => (
        <ToolCard key={`${tc.name}-${i}`} tool={tc} />
      ))}
      {msg.content && (
        <div className="prose prose-invert prose-sm max-w-none text-white/85 [&_pre]:bg-white/5 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded [&_code]:text-emerald-400/80 [&_a]:text-blue-400 [&_a:hover]:underline">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 py-2 px-1">
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
      <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

export function ChatPanel({
  webuiBaseUrl,
  model,
  skillName,
  startedAt,
  webuiUrl,
  onStop,
  onTryAnother,
}: {
  webuiBaseUrl: string;
  model: string;
  skillName: string;
  startedAt: number;
  webuiUrl: string;
  onStop: () => void;
  onTryAnother?: () => void;
}) {
  const { messages, isStreaming, error, approval, send, cancel, setApproval } = useChat(
    webuiBaseUrl,
    model,
    skillName,
  );

  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await send(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto w-full">
      {/* TopBar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-white/70 font-mono">{skillName}</span>
        <span className="text-xs text-white/30 font-mono">{formatTime(elapsed)}</span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={webuiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 rounded transition-all"
          >
            Open full WebUI
          </a>
          {onTryAnother && (
            <button
              onClick={onTryAnother}
              className="px-3 py-1.5 text-xs text-amber-400/60 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded transition-all"
            >
              Try Another
            </button>
          )}
          <button
            onClick={onStop}
            className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded transition-all"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <ThinkingDots />
        )}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 mb-4">
            {error}
          </div>
        )}
        {approval && (
          <ApprovalCard
            approval={approval}
            webuiBaseUrl={webuiBaseUrl}
            onDismiss={() => setApproval(null)}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Hermes..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/90 placeholder:text-white/25 outline-none focus:border-white/25 resize-none disabled:opacity-50 transition-colors"
          />
          {isStreaming ? (
            <button
              onClick={cancel}
              className="px-4 py-2.5 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-all shrink-0"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 transition-all shrink-0"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
