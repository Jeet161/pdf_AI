import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";
import Navbar from "@/components/Navbar";

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

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let documents: DocumentItem[] = [];
  let loadError: string | null = null;

  try {
    const res = await fetch(`${BACKEND_URL}/documents`, {
      headers: backendAuthHeaders(session.user.id),
      cache: "no-store",
    });
    if (res.ok) documents = await res.json();
    else loadError = "Could not load documents.";
  } catch {
    loadError = "Could not reach the backend.";
  }

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        {/* Ambient background blobs */}
        <div className="absolute top-32 left-20 w-80 h-80 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-40 right-20 w-96 h-96 rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: "3s" }} />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-8 md:p-12 shadow-2xl mb-12 border border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.2),transparent_60%)] pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <p className="text-indigo-400 text-sm font-semibold mb-3 tracking-widest uppercase">AI Research Platform</p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Unlock the power of{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Document AI
              </span>
            </h1>
            <p className="mt-4 text-indigo-200 text-sm md:text-base leading-relaxed opacity-80">
              Upload research papers, reports, or contracts. Get instant summaries, key insights, and chat with your documents using advanced RAG technology.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/documents"
                className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-purple-500 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
              >
                Go to Workspace →
              </Link>
              <Link
                href="/tools"
                className="rounded-2xl bg-white/10 border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all duration-300 active:scale-95"
              >
                Launch PDF Tools
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10 relative z-10">
          <div className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-3xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              📂
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-6">AI Document Workspace</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Analyze documents. Generate summaries, extract key insights, and query details using retrieval-augmented generation grounded in your actual files.
            </p>
            <Link href="/documents" className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 group/link">
              Go to Library <span className="transition-transform group-hover/link:translate-x-1">→</span>
            </Link>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950 text-3xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              🛠️
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-6">PDF Utilities</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Lightweight tools to manage your files. Merge PDFs, split pages, convert images to PDF, or extract pages as images. No AI required.
            </p>
            <Link href="/tools" className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 group/link">
              Launch Utilities <span className="transition-transform group-hover/link:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {/* Recent Docs */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Recent Documents</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quick access to your latest files</p>
            </div>
            <Link href="/documents" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
              View all ({documents.length}) →
            </Link>
          </div>

          {loadError && (
            <div className="rounded-2xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-xs font-semibold text-red-600 dark:text-red-400">
              {loadError}
            </div>
          )}

          {!loadError && recentDocs.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <span className="text-4xl block mb-3">📄</span>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No documents yet.</p>
              <Link href="/documents" className="text-indigo-600 dark:text-indigo-400 font-bold text-xs mt-1 inline-block hover:underline">
                Upload your first PDF
              </Link>
            </div>
          )}

          {!loadError && recentDocs.length > 0 && (
            <div className="grid gap-4">
              {recentDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="group flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg shadow-sm group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white transition-all duration-300">
                      📄
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {doc.original_filename}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{formatFileSize(doc.file_size_bytes)}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all shadow-sm">
                    →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

