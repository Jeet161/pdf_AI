import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";
import FullScreenChat from "@/components/document/FullScreenChat";

interface DocumentDetail {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  uploaded_at: string;
  extracted_text: string | null;
  summary: string | null;
  main_points: string[] | null;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const res = await fetch(`${BACKEND_URL}/documents/${id}`, {
    headers: backendAuthHeaders(session.user.id),
    cache: "no-store",
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error("Could not load this document.");
  }

  const document: DocumentDetail = await res.json();

  return <FullScreenChat document={document} />;
}
