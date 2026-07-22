import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { backendAuthHeaders, BACKEND_URL } from "@/lib/backend-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  const backendResponse = await fetch(`${BACKEND_URL}/documents/${id}`, {
    headers: backendAuthHeaders(session.user.id),
    cache: "no-store",
  });

  try {
    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch {
    return NextResponse.json({ detail: "Error fetching document" }, { status: backendResponse.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  const backendResponse = await fetch(`${BACKEND_URL}/documents/${id}`, {
    method: "DELETE",
    headers: backendAuthHeaders(session.user.id),
  });

  if (backendResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch {
    return new NextResponse(null, { status: backendResponse.status });
  }
}
