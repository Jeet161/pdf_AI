import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const targetSizeKb = formData.get("target_size_kb") || "500";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const backendFormData = new FormData();
  backendFormData.append("file", file);
  backendFormData.append("target_size_kb", targetSizeKb);

  try {
    const res = await fetch(`${BACKEND_URL}/tools/compress`, {
      method: "POST",
      headers: backendAuthHeaders(session.user.id),
      body: backendFormData,
    });

    if (!res.ok) {
      let errorDetail = "Failed to compress file.";
      try {
        const errData = await res.json();
        errorDetail = errData.detail || errorDetail;
      } catch {
        // Ignored
      }
      return NextResponse.json({ error: errorDetail }, { status: res.status });
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const disposition = res.headers.get("content-disposition");

    const response = new NextResponse(blob);
    response.headers.set("Content-Type", contentType);
    if (disposition) {
      response.headers.set("Content-Disposition", disposition);
    }
    return response;
  } catch (error) {
    console.error("Error compressing file:", error);
    return NextResponse.json(
      { error: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
