import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { text } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "请输入内容" }, { status: 400 });
    }

    const endpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
    const apiKey = getConfig("llm_api_key");
    const model = getConfig("llm_model") || "gpt-4o";

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "请先配置 LLM API Key" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的文生图/视频提示词润色师。用户会提供一段描述，请将其优化为更专业、更详细的提示词。

规则：
1. 用英文输出（除非原文是中文且不可翻译的场景），但输出尽量用英文
2. 扩充细节：主体、环境、光线、风格、构图、氛围
3. 添加画质增强词（highly detailed, 8k, masterpiece, professional photography 等）
4. 加入人体结构正确性要求（perfect anatomy, anatomically correct, no extra limbs 等）
5. 保持原文的核心意图，不要偏离主题
6. 长度控制在 80-250 词
7. 只输出润色后的提示词，不要加任何解释`;

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请润色以下文生图/视频提示词：${text}` },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `LLM 错误: ${await response.text()}` }, { status: 500 });
    }

    const data = await response.json();
    const polished = data.choices?.[0]?.message?.content?.trim();

    if (!polished) {
      return NextResponse.json({ success: false, error: "润色失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { text: polished } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "润色失败" }, { status: 500 });
  }
}
