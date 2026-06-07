import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordGroups, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { defaultKeywordGroups, legacyKeywordGroupSlugs } from "@/lib/keyword-presets";

function syncDefaultKeywordGroups() {
  const groups = db.select().from(keywordGroups).all();
  const existingSlugs = new Set(groups.map((group) => group.slug));
  const hasLegacyDefaults = legacyKeywordGroupSlugs.some((slug) => existingSlugs.has(slug));
  const hasLegacyOnlyGroups = ["character", "style"].some((slug) => existingSlugs.has(slug));
  const hasAnyDefaultGroup = defaultKeywordGroups.some((group) => existingSlugs.has(group.slug));

  if (groups.length === 0) {
    for (const group of defaultKeywordGroups) {
      const inserted = db.insert(keywordGroups).values({ name: group.name, slug: group.slug }).returning().get();
      for (const keyword of group.keywords) {
        db.insert(keywords).values({ groupId: inserted.id, name: keyword }).run();
      }
    }
    return;
  }

  if (!hasLegacyOnlyGroups || !hasLegacyDefaults || !hasAnyDefaultGroup) return;

  for (const group of groups) {
    if (legacyKeywordGroupSlugs.includes(group.slug)) {
      db.delete(keywords).where(eq(keywords.groupId, group.id)).run();
      db.delete(keywordGroups).where(eq(keywordGroups.id, group.id)).run();
    }
  }

  for (const group of defaultKeywordGroups) {
    const inserted = db.insert(keywordGroups).values({ name: group.name, slug: group.slug }).returning().get();
    for (const keyword of group.keywords) {
      db.insert(keywords).values({ groupId: inserted.id, name: keyword }).run();
    }
  }
}

export async function GET() {
  syncDefaultKeywordGroups();

  const groups = db.select().from(keywordGroups).all();
  const presetMeta = new Map(defaultKeywordGroups.map((group) => [group.slug, group]));
  const result = groups.map((g) => ({
    ...g,
    description: presetMeta.get(g.slug)?.description,
    keywords: db.select().from(keywords).where(eq(keywords.groupId, g.id)).all(),
  })).sort((a, b) => {
    const ai = defaultKeywordGroups.findIndex((group) => group.slug === a.slug);
    const bi = defaultKeywordGroups.findIndex((group) => group.slug === b.slug);
    if (ai === -1 && bi === -1) return a.id - b.id;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
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
