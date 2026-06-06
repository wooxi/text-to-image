import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordGroups, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const groups = db.select().from(keywordGroups).all();
  const result = groups.map((g) => ({
    ...g,
    keywords: db.select().from(keywords).where(eq(keywords.groupId, g.id)).all(),
  }));
  return NextResponse.json({ success: true, data: result });
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { name, slug, keywords: kwList } = await request.json();
    if (!name || !slug || !Array.isArray(kwList)) {
      return NextResponse.json({ success: false, error: "参数错误" }, { status: 400 });
    }

    const group = db.insert(keywordGroups).values({ name, slug }).returning().get();
    for (const kw of kwList) {
      if (kw && typeof kw === "string" && kw.trim()) {
        db.insert(keywords).values({ groupId: group.id, name: kw.trim() }).run();
      }
    }
    return NextResponse.json({ success: true, data: group });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "创建失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();
    const { id, name, keywords: kwList } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ success: false, error: "参数错误" }, { status: 400 });
    }

    db.update(keywordGroups).set({ name }).where(eq(keywordGroups.id, id)).run();

    if (Array.isArray(kwList)) {
      db.delete(keywords).where(eq(keywords.groupId, id)).run();
      for (const kw of kwList) {
        if (kw && typeof kw === "string" && kw.trim()) {
          db.insert(keywords).values({ groupId: id, name: kw.trim() }).run();
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "更新失败" }, { status: 500 });
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

    db.delete(keywords).where(eq(keywords.groupId, Number(id))).run();
    db.delete(keywordGroups).where(eq(keywordGroups.id, Number(id))).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}
