import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, imageHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

function parseContentPolicyError(errorData: unknown): string {
  try {
    const err = errorData as Record<string, unknown>;
    const msg = String(err?.message || err?.error || "");
    
    if (msg.includes("内容政策") || msg.includes("content_policy") || msg.includes("性化") || msg.includes("物化") || msg.includes("不适合生成")) {
      return "内容安全拦截：提示词中可能包含不当描述，请修改关键词后重试。可以尝试更换角度描述（如从时尚摄影、商业展示角度），减少对身体特定部位的过度特写。";
    }
    if (msg.includes("足部") || msg.includes("丝袜") || msg.includes("恋物")) {
      return "内容安全拦截：请避免对身体部位的过度特写和性感化描述。如需展示服饰/搭配，建议使用全身或半身构图。";
    }
    if (msg.includes("安全") || msg.includes("违规") || msg.includes("policy")) {
      return "内容安全拦截：提示词未通过安全审核，请调整关键词。建议使用更中性、专业的描述词汇。";
    }
    return "生图失败：" + msg.substring(0, 200);
  } catch {
    return "生图失败：未知错误";
  }
}

async function downloadImage(url: string, savePath: string): Promise<void> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error(`下载图片失败: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(savePath, buffer);
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { prompt, keywords, size: requestSize } = await request.json();
    if (!prompt) {
      return NextResponse.json({ success: false, error: "缺少提示词" }, { status: 400 });
    }

    const endpoint = getConfig("image_endpoint") || "https://api.openai.com/v1";
    const apiKey = getConfig("image_api_key");
    const model = getConfig("image_model") || "dall-e-3";
    const size = requestSize || getConfig("image_size") || "1024x1024";

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "请先在后台配置生图 API Key" }, { status: 400 });
    }

    const url = endpoint.replace(/\/+$/, "") + "/images/generations";

    // Enhanced quality suffix with safety awareness
    const qualitySuffix = ", professional photography, highly detailed, masterpiece, sharp focus, elegant composition, natural lighting, anatomically correct, clean aesthetic, commercial photography style";
    const finalPrompt = prompt + qualitySuffix;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: finalPrompt,
        n: 1,
        size,
        extra_body: {
          response_format: "url",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errData: unknown;
      try { errData = JSON.parse(errText); } catch { errData = { error: { message: errText } }; }
      const userMsg = parseContentPolicyError(errData);
      return NextResponse.json({ success: false, error: userMsg }, { status: 500 });
    }

    const data = await response.json();
    
    // Check for error in 200 response (some APIs do this)
    if (data.error) {
      const userMsg = parseContentPolicyError(data);
      return NextResponse.json({ success: false, error: userMsg }, { status: 500 });
    }

    const imageData = data.data?.[0];

    if (!imageData) {
      return NextResponse.json({ success: false, error: "生图返回数据为空，API 可能返回了异常响应" }, { status: 500 });
    }

    const publicDir = path.join(process.cwd(), "public", "images", "generated");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const filename = `${uuidv4()}.png`;
    const savePath = path.join(publicDir, filename);

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, "base64");
      fs.writeFileSync(savePath, buffer);
    } else if (imageData.url) {
      await downloadImage(imageData.url, savePath);
    } else {
      return NextResponse.json({ success: false, error: "生图返回格式不支持，请检查 API 配置" }, { status: 500 });
    }

    const imagePath = `/images/generated/${filename}`;

    db.insert(imageHistory).values({
      keywordNames: keywords || prompt,
      prompt,
      imagePath,
      type: "image",
    }).run();

    return NextResponse.json({ success: true, data: { imagePath, prompt } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: `生成失败: ${(e as Error).message}` }, { status: 500 });
  }
}
