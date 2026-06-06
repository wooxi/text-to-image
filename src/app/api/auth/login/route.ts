import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, error: "用户名和密码不能为空" }, { status: 400 });
    }

    const user = db.select().from(users).where(eq(users.username, username)).get();
    if (!user) {
      return NextResponse.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "用户名或密码错误" }, { status: 401 });
    }

    const token = await createToken(user.id, user.username);
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ success: true, data: { username: user.username } });
  } catch {
    return NextResponse.json({ success: false, error: "登录失败" }, { status: 500 });
  }
}
