"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function uploadFile(file: File) {
    setError(null);

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      setError("Only PDF and Image files (PNG, JPG, JPEG, WEBP) are supported.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Upload failed. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
        dragActive
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
          : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileSelected}
        disabled={isUploading}
        className="hidden"
        id="pdf-upload-input"
      />

      <div className="flex flex-col items-center justify-center">
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
          isUploading
            ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 animate-pulse"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
        }`}>
          {isUploading ? (
            <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        <label
          htmlFor="pdf-upload-input"
          className={`cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
            isUploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {isUploading ? "Uploading file..." : "Click to upload or drag & drop"}
        </label>

        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">PDFs & Images (PNG, JPG, WEBP) up to 20 MB</p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

