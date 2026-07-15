import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";
import UploadForm from "@/components/upload/UploadForm";
import Navbar from "@/components/Navbar";
import DeleteDocumentButton from "@/components/document/DeleteDocumentButton";

interface DocumentItem {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  uploaded_at: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  let documents: DocumentItem[] = [];
  let loadError: string | null = null;

  try {
    const res = await fetch(`${BACKEND_URL}/documents`, {
      headers: backendAuthHeaders(session.user.id),
      cache: "no-store",
    });

    if (res.ok) {
      documents = await res.json();
    } else {
      loadError = "Could not load your documents.";
    }
  } catch {
    loadError = "Could not reach the backend.";
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 relative">
        {/* Background glow */}
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none animate-pulse-glow" />

        {/* Header */}
        <div className="mb-10 flex items-center justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              My Workspace
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
              Upload your documents to analyze and chat with them using retrieval-augmented generation.
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition active:scale-95"
          >
            &larr; Home
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-3 relative z-10">
          {/* Upload Column (1/3) */}
          <div className="md:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">Upload PDF</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                Add a PDF. Once processed, it will be listed in your workspace for analysis and chat.
              </p>
              <UploadForm />
            </div>
          </div>

          {/* List Column (2/3) */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm min-h-[400px]">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Your PDF Files</h2>
                {!loadError && documents.length > 0 && (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                    {documents.length} File{documents.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {loadError && (
                <div className="rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-xs font-semibold text-red-600 dark:text-red-400">
                  {loadError}
                </div>
              )}

              {!loadError && documents.length === 0 && (
                <div className="text-center py-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <span className="text-5xl block mb-4">📂</span>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Documents Uploaded</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                    Use the upload panel to upload your first PDF file and begin.
                  </p>
                </div>
              )}

              {!loadError && documents.length > 0 && (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="group flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 duration-200"
                    >
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-4 min-w-0 flex-1"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-lg shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300">
                          📄
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {doc.original_filename}
                          </h3>
                          <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                            <span>{formatFileSize(doc.file_size_bytes)}</span>
                            <span>•</span>
                            <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2.5 shrink-0 ml-4">
                        <DeleteDocumentButton documentId={doc.id} filename={doc.original_filename} />
                        <Link
                          href={`/documents/${doc.id}`}
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all shadow-sm active:scale-95"
                        >
                          &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
