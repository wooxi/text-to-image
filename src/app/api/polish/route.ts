import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

const IMAGE_SYSTEM_PROMPT = `你是一位专业的文生图提示词润色师。用户会提供一段描述，请将其优化为更专业、更详细的文生图提示词。

规则：
1. 用英文输出
2. 扩充细节：主体、环境、光线、风格、构图、氛围
3. 添加画质增强词（highly detailed, 8k, masterpiece, professional photography, sharp focus 等）
4. 加入人体结构正确性要求（perfect anatomy, anatomically correct, no extra limbs, no merged body parts, correct number of fingers and toes 等）
5. 保持原文核心意图，不要偏离主题
6. 长度控制在 80-250 词
7. 只输出润色后的提示词，不要加任何解释、引号或前缀`;

const VIDEO_SYSTEM_PROMPT = `你是一位专业的 AI 视频提示词润色师。用户会提供一段描述，请将其优化为更专业、更适合视频生成的提示词。

与图片不同，视频提示词的核心差异：
1. 动作与运动：描述主体的具体动作、运动轨迹、速度、节奏感
2. 镜头语言：推拉摇移、跟拍、特写转全景、环绕、升降等运镜方式
3. 时间感：动作的节奏、变化的过渡、起承转合
4. 场景动态：风吹发丝、水波荡漾、光影流转、衣摆飘动等持续动态
5. 氛围与情绪：通过运动、镜头节奏和场景变化传递的情感

规则：
- 用英文输出
- 长度 80-200 词
- 不要包含静态人体结构要求（如 perfect anatomy、no extra limbs 等是图片专用词，视频不需要）
- 强调连续运动和镜头运动，而非静态构图
- 保持原文核心意图，不要偏离主题
- 只输出润色后的提示词，不要加任何解释、引号或前缀`;

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { text, mode } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "请输入内容" }, { status: 400 });
    }

    const endpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
    const apiKey = getConfig("llm_api_key");
    const model = getConfig("llm_model") || "gpt-4o";

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "请先配置 LLM API Key" }, { status: 400 });
    }

    const isVideo = mode === "video";
    const systemPrompt = isVideo ? VIDEO_SYSTEM_PROMPT : IMAGE_SYSTEM_PROMPT;
    const userLabel = isVideo ? "视频画面描述" : "文生图提示词";

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请润色以下${userLabel}：${text}` },
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
