import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { username, password } = await request.json();
    if (!username || !password || password.length < 6) {
      return NextResponse.json({ success: false, error: "用户名不能为空，密码至少6位" }, { status: 400 });
    }

    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      return NextResponse.json({ success: false, error: "用户名已存在" }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.insert(users).values({ username, passwordHash: hash }).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "注册失败" }, { status: 500 });
  }
}
