import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import crypto from "crypto";

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  if (!INTERNAL_API_SECRET) {
    return NextResponse.json({ detail: "Server misconfiguration: missing internal secret." }, { status: 500 });
  }

  const userId = session.user.id;
  const expiresAt = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
  const message = `${userId}:${expiresAt}`;
  
  const signature = crypto
    .createHmac("sha256", INTERNAL_API_SECRET)
    .update(message)
    .digest("hex");

  const token = `${userId}:${expiresAt}:${signature}`;

  return NextResponse.json({ token });
}
