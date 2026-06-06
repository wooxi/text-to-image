import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageHistory } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();
    const records = db.select().from(imageHistory).orderBy(desc(imageHistory.createdAt)).all();
    return NextResponse.json({ success: true, data: records });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "缺少id" }, { status: 400 });
    }

    const record = db.select().from(imageHistory).where(eq(imageHistory.id, Number(id))).get();
    if (record) {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", record.imagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.delete(imageHistory).where(eq(imageHistory.id, Number(id))).run();
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}
