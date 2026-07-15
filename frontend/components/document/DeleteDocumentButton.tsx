"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteDocumentButtonProps {
  documentId: string;
  filename: string;
  redirectTo?: string;
}

export default function DeleteDocumentButton({ documentId, filename, redirectTo }: DeleteDocumentButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    setShowConfirm(false);

    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });

      if (res.ok) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        alert("Failed to delete document.");
      }
    } catch {
      alert("Error deleting document. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold uppercase animate-pulse">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded bg-red-600 hover:bg-red-700 px-2 py-1 text-[10px] font-bold text-white transition disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowConfirm(true);
      }}
      disabled={isDeleting}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-sm"
      title={`Delete ${filename}`}
    >
      {isDeleting ? (
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  );
}

