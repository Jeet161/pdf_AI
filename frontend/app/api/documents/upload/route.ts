import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  // Pass the incoming multipart form data straight through to FastAPI.
  const formData = await request.formData();

  const backendResponse = await fetch(`${BACKEND_URL}/documents/upload`, {
    method: "POST",
    headers: backendAuthHeaders(session.user.id),
    body: formData,
  });

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}
