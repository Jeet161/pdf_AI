"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface DocumentInfo {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  summary: string | null;
  main_points: string[] | null;
  extracted_text: string | null;
  status?: string;
}

interface Props {
  document: DocumentInfo;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FullScreenChat({ document }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "analysis">("text");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [textSize, setTextSize] = useState(12);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [localDocument, setLocalDocument] = useState<DocumentInfo>(document);

  // Auto-poll document state if OCR / scanning is in progress in the background
  useEffect(() => {
    const isProcessing =
      localDocument.status === "processing" ||
      (!localDocument.extracted_text && localDocument.status !== "failed");

    if (!isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${localDocument.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.extracted_text || data.status === "completed" || data.status === "failed") {
            setLocalDocument((prev) => ({
              ...prev,
              extracted_text: data.extracted_text ?? prev.extracted_text,
              status: data.status ?? (data.extracted_text ? "completed" : "failed"),
              summary: data.summary ?? prev.summary,
              main_points: data.main_points ?? prev.main_points,
            }));
          }
        }
      } catch {
        // Ignore background polling errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [localDocument.id, localDocument.status, localDocument.extracted_text]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = Math.max(240, Math.min(e.clientX, 800));
        setSidebarWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Analysis failed.");
        return;
      }
      // Update local copy of document with freshly returned analysis
      setLocalDocument((prev) => ({
        ...prev,
        summary: data.summary ?? prev.summary,
        main_points: data.main_points ?? prev.main_points,
        extracted_text: data.extracted_text ?? prev.extracted_text,
        status: "completed",
      }));
      setActiveTab("analysis");
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRetry() {
    setIsRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${localDocument.id}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        setLocalDocument((prev) => ({ ...prev, status: "processing", extracted_text: null }));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Retry failed. Please try again later.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsRetrying(false);
    }
  }

  useEffect(() => {
    fetch(`/api/documents/${document.id}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [document.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      },
    ]);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch(`/api/documents/${document.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Something went wrong.");
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
      setError("Could not reach the server.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuestion(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  }

  return (
    <div 
      className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-100"
      style={{ userSelect: isResizing ? "none" : "auto" }}
    >

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside
        style={{ width: sidebarWidth }}
        className={`
          fixed inset-y-0 left-0 z-40 flex-shrink-0
          border-r border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Drag handle for resizing */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-50 hidden lg:block"
          onMouseDown={startResizing}
        />
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <Link
            href="/documents"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Library
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Document pill */}
        <div className="p-4 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 shadow-lg shadow-indigo-500/20">
            <span className="text-2xl">📄</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{document.original_filename}</p>
              <p className="text-xs text-indigo-200 mt-0.5">{formatFileSize(document.file_size_bytes)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3 shrink-0">
          {(["text", "analysis"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold capitalize transition-all ${
                activeTab === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 text-sm">
          {/* Global Font Size Controls */}
          <div className="flex items-center justify-end mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10 -mx-4 px-4 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-2">Text Size</span>
              <button
                onClick={() => setTextSize(prev => Math.max(10, prev - 2))}
                className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm"
                title="Decrease font size"
              >
                -
              </button>
              <span className="text-[11px] font-semibold w-5 text-center text-slate-600 dark:text-slate-400">{textSize}</span>
              <button
                onClick={() => setTextSize(prev => Math.min(28, prev + 2))}
                className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm"
                title="Increase font size"
              >
                +
              </button>
            </div>
          </div>

          {activeTab === "text" && (
            <div>
              {localDocument.extracted_text ? (
                <pre 
                  className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200"
                  style={{ fontSize: `${textSize}px`, lineHeight: 1.6 }}
                >
                  {localDocument.extracted_text}
                </pre>
              ) : localDocument.status === "processing" ? (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/40 p-5 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                    <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    ⚡ Scanning &amp; Extracting Text...
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
                    Gemini AI is reading and transcribing pages in the background. The text will automatically appear here once complete!
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                    Auto-refreshing live...
                  </div>
                </div>
              ) : localDocument.status === "failed" || (!localDocument.extracted_text && localDocument.status !== "processing") ? (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 p-5 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  </div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    ⚠️ Extraction Failed
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                    The Gemini AI free-tier daily quota is exhausted. OCR will resume automatically after midnight Pacific Time (~1:30 PM IST).
                  </p>
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="mt-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 transition shadow-sm flex items-center gap-2 mx-auto"
                  >
                    {isRetrying ? (
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : "🔄"}
                    {isRetrying ? "Retrying..." : "Retry Extraction"}
                  </button>
                  {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-8">No text extracted from this document.</p>
              )}
            </div>
          )}

          {activeTab === "analysis" && (
            <div className="space-y-4">
              {localDocument.summary ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Summary</p>
                    <p 
                      className="text-slate-700 dark:text-slate-200 leading-relaxed"
                      style={{ fontSize: `${textSize}px`, lineHeight: 1.6 }}
                    >
                      {localDocument.summary}
                    </p>
                  </div>
                  {localDocument.main_points && localDocument.main_points.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Key Points</p>
                      <ul className="space-y-2">
                        {(localDocument.main_points ?? []).map((pt, i) => (
                          <li 
                            key={i} 
                            className="flex gap-2 text-slate-700 dark:text-slate-200"
                            style={{ fontSize: `${textSize}px`, lineHeight: 1.6 }}
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
                ) : (
                  <div className="flex flex-col items-center gap-4 pt-8 text-center">
                    <div className="text-4xl">🔍</div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      No analysis yet. Click below to let the AI summarize and extract key points from this document.
                    </p>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analyzing...
                        </>
                      ) : (
                        <>✨ Analyze Document</>
                      )}
                    </button>
                    {error && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main chat area ────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 h-screen">

        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Link href="/documents" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">
              Library
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[280px]">
              {document.original_filename}
            </span>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 border border-indigo-100 dark:border-indigo-900">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">AI Document Assistant</span>
            </div>
          </div>

          <div className="w-24 lg:w-auto flex justify-end">
            <Link
              href="/documents"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm hidden sm:block"
            >
              ← Library
            </Link>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

            {isLoadingHistory && (
              <div className="flex justify-center pt-16">
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading conversation...
                </div>
              </div>
            )}

            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center pt-20 pb-8">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl mb-6 shadow-xl shadow-indigo-500/20">
                  🧠
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
                  Ask about this document
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md leading-relaxed">
                  I&apos;ve read <span className="font-semibold text-indigo-600 dark:text-indigo-400">{document.original_filename}</span>. Ask me anything — I&apos;ll answer based on its contents.
                </p>
                {/* Suggested prompts */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    "Summarize this document in 3 bullet points",
                    "What are the key findings?",
                    "Who are the main people mentioned?",
                    "What dates or deadlines are mentioned?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setQuestion(prompt);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-400 transition-all shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm mt-0.5 shadow-md">
                    🧠
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className="text-lg font-bold mb-2 mt-1">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
                        p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({children}) => <ul className="list-disc list-outside pl-5 mb-2 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-outside pl-5 mb-2 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="leading-relaxed">{children}</li>,
                        strong: ({children}) => <strong className="font-bold">{children}</strong>,
                        em: ({children}) => <em className="italic">{children}</em>,
                        code: ({children}) => <code className="bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>,
                        pre: ({children}) => <pre className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
                        hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-indigo-400 pl-3 italic text-slate-500 dark:text-slate-400 mb-2">{children}</blockquote>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm mt-0.5">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm shadow-md">
                  🧠
                </div>
                <div className="rounded-2xl rounded-bl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <div className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Pinned bottom input ──────────────────────────── */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4">
          {error && (
            <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-xl focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:shadow-indigo-500/10 transition-all duration-300">
              <textarea
                ref={textareaRef}
                rows={1}
                value={question}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this document..."
                disabled={isSending}
                className="flex-1 resize-none bg-transparent text-base text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none disabled:opacity-50 leading-relaxed"
                style={{ minHeight: "32px", maxHeight: "180px" }}
              />
              <button
                type="submit"
                disabled={isSending || !question.trim()}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 shadow-md active:scale-95"
              >
                {isSending ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
                <span>{isSending ? "Thinking..." : "Send"}</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-600">
              <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to send &nbsp;·&nbsp;
              <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

