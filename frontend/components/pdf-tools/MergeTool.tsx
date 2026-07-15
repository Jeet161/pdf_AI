"use client";

import { useState } from "react";

export default function MergeTool() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length < 2) {
      setError("Select at least 2 PDF files.");
      return;
    }

    setError(null);
    setIsWorking(true);

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/tools/merge", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail ?? "Merge failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
        />
      </div>
      
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 border border-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isWorking || !files || files.length < 2}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
      >
        {isWorking ? "Merging..." : "Merge & Download"}
      </button>
    </form>
  );
}

