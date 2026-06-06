import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, imageHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { keywords } = await request.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ success: false, error: "请选择至少一个关键词" }, { status: 400 });
    }

    const endpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
    const apiKey = getConfig("llm_api_key");
    const model = getConfig("llm_model") || "gpt-4o";

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "请先在后台配置 LLM API Key" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的文生图提示词工程师。用户会提供一组关键词标签，请根据这些标签生成一条高质量的英文文生图提示词。

核心规则（必须遵守）：
1. 用英文输出，因为主流生图模型对英文理解更好
2. 包含画面主体、环境/背景、光线、风格、构图、氛围等要素
3. 适当添加画质增强词（highly detailed, 8k, masterpiece, professional photography, sharp focus 等）
4. 长度控制在 80-250 词之间

画质与规范性要求（必须包含在提示词中）：
- perfect anatomy, correct human proportions, anatomically correct
- no extra limbs, no missing limbs, no fused fingers, no deformed hands
- five fingers on each hand if visible, natural hand poses
- symmetrical face if facing camera, correct number of limbs

输出格式：
- 只输出提示词本身，不要加任何解释、引号、前缀或后缀
- 不要输出思考过程，直接给最终提示词
- 不要用 markdown 代码块包裹`;

    const userMessage = `关键词标签: ${keywords.join(", ")}。请生成一条专业的文生图提示词，确保包含人体结构正确性要求。`;

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 2048,
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ success: false, error: `LLM API 错误: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const prompt = data.choices?.[0]?.message?.content?.trim();

    if (!prompt) {
      return NextResponse.json({ success: false, error: "生成提示词失败，模型未返回有效内容" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { prompt } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "生成失败" }, { status: 500 });
  }
}
