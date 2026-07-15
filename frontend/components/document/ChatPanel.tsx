"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function ChatPanel({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);

    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setQuestion("");

    try {
      const res = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Please try again.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}-a`,
          role: "assistant",
          content: data.answer,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Messages area */}
      <div className="h-[340px] space-y-4 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
        {isLoadingHistory && (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading conversation history...
            </span>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center h-full p-4">
            <span className="text-2xl mb-1">💬</span>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Messages Yet</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[200px] leading-relaxed">
              Ask questions about the document. Answers are grounded in its actual content.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-sm"
                }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-sm">
              <div className="flex gap-1 items-center py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something about this PDF..."
          disabled={isSending}
          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50 placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={isSending || !question.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

