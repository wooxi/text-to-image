import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: true, data: null });
  }
  return NextResponse.json({ success: true, data: { username: session.username } });
}
