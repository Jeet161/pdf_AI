"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
  initialSummary: string | null;
  initialMainPoints: string[] | null;
}

export default function AnalyzeSection({ documentId, initialSummary, initialMainPoints }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [mainPoints, setMainPoints] = useState(initialMainPoints);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Analysis failed. Please try again.");
        return;
      }

      setSummary(data.summary);
      setMainPoints(data.main_points);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">
          Summary &amp; Key Insights
        </span>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="rounded-xl bg-indigo-600 dark:bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </span>
          ) : summary ? "Re-Analyze" : "Analyze with AI"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!summary && !isAnalyzing && !error && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Click "Analyze with AI" to extract a summary and key bullet points.
          </p>
        </div>
      )}

      {summary && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          {summary}
        </p>
      )}

      {mainPoints && mainPoints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Key Insights
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {mainPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

