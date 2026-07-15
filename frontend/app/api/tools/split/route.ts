import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();

  const backendResponse = await fetch(`${BACKEND_URL}/tools/split`, {
    method: "POST",
    headers: backendAuthHeaders(session.user.id),
    body: formData,
  });

  if (!backendResponse.ok) {
    const err = await backendResponse.json();
    return NextResponse.json(err, { status: backendResponse.status });
  }

  const blob = await backendResponse.blob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=split-pages.zip",
    },
  });
}
