import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import MergeTool from "@/components/pdf-tools/MergeTool";
import SplitTool from "@/components/pdf-tools/SplitTool";
import ImagesToPdfTool from "@/components/pdf-tools/ImagesToPdfTool";
import PdfToImagesTool from "@/components/pdf-tools/PdfToImagesTool";
import CompressTool from "@/components/pdf-tools/CompressTool";
import Navbar from "@/components/Navbar";

export default async function ToolsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              PDF Utilities
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
              Quick tools to manage, split, merge, or convert your PDF files on the fly.
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition"
          >
            &larr; Home
          </Link>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">🔗</span>
              <div>
                <h2 className="text-md font-bold text-slate-900 dark:text-slate-100">Merge PDFs</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Combine multiple PDF files into a single document</p>
              </div>
            </div>
            <MergeTool />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">✂️</span>
              <div>
                <h2 className="text-md font-bold text-slate-900 dark:text-slate-100">Split PDF</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Split a PDF document into individual page files</p>
              </div>
            </div>
            <SplitTool />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">🖼️</span>
              <div>
                <h2 className="text-md font-bold text-slate-900 dark:text-slate-100">Images to PDF</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Convert JPG or PNG images into a clean PDF document</p>
              </div>
            </div>
            <ImagesToPdfTool />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">📄</span>
              <div>
                <h2 className="text-md font-bold text-slate-900 dark:text-slate-100">PDF to Images</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Convert each page of a PDF document into a PNG image</p>
              </div>
            </div>
            <PdfToImagesTool />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">🗜️</span>
              <div>
                <h2 className="text-md font-bold text-slate-900 dark:text-slate-100">Compress File</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Compress the file size of a PDF or Image</p>
              </div>
            </div>
            <CompressTool />
          </div>
        </div>
      </main>
    </div>
  );
}

