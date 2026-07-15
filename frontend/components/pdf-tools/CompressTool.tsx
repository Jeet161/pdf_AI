"use client";

import { useState, useRef } from "react";

export default function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [targetSizeKB, setTargetSizeKB] = useState(500);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_size_kb", targetSizeKB.toString());

    try {
      const res = await fetch("/api/tools/compress", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Failed to compress file.";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // ignore
        }
        setError(msg);
        setIsProcessing(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      
      // Determine file extension based on original file or content type
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const baseName = file.name.split(".").slice(0, -1).join(".") || "compressed";
      const ext = isPdf ? ".pdf" : ".jpg";
      a.download = `compressed-${baseName}${ext}`;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError("An error occurred while compressing the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
          Upload File (PDF or Image)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/jpg"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="block w-full text-sm text-slate-500 dark:text-slate-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-xl file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              dark:file:bg-indigo-950 dark:file:text-indigo-400
              hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900
              transition-colors cursor-pointer"
          />
        </div>
        {file && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            Selected: <span className="font-medium text-slate-700 dark:text-slate-300">{file.name}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
          Target File Size (KB)
        </label>
        <div className="relative">
          <input
            type="number"
            min="10"
            max="50000"
            value={targetSizeKB}
            onChange={(e) => setTargetSizeKB(Number(e.target.value))}
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-slate-400 dark:text-slate-500 text-sm">KB</span>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-500">
          <strong>Images:</strong> We'll compress the image to be as close to this size as possible. <br/>
          <strong>PDFs:</strong> We apply maximum compression to PDFs, but cannot guarantee an exact file size without breaking formatting.
        </p>
      </div>

      <button
        onClick={handleProcess}
        disabled={!file || isProcessing}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Compressing...
          </>
        ) : (
          "Compress File"
        )}
      </button>
    </div>
  );
}

