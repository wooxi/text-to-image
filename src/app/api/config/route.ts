import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const items = db.select().from(config).all();
  const map: Record<string, string> = {};
  for (const item of items) {
    map[item.key] = item.value;
  }
  return NextResponse.json({ success: true, data: map });
}

export async function PUT(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;
      const existing = db.select().from(config).where(eq(config.key, key)).get();
      const now = new Date().toISOString();
      if (existing) {
        db.update(config).set({ value, updatedAt: now }).where(eq(config.key, key)).run();
      } else {
        db.insert(config).values({ key, value, updatedAt: now }).run();
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "保存失败" }, { status: 500 });
  }
}
