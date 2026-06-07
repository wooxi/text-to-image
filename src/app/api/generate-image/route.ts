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

    const qualitySuffix = ", perfect anatomy, anatomically correct, each body part clearly separated and distinct, no merged limbs, no hands touching legs, no extra appendages, correct number of fingers and toes, natural body proportions, no deformities, professional photography, highly detailed, masterpiece";
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
      return NextResponse.json({ success: false, error: `生图 API 错误: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const imageData = data.data?.[0];

    if (!imageData) {
      return NextResponse.json({ success: false, error: "生图返回数据为空" }, { status: 500 });
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
      return NextResponse.json({ success: false, error: "生图返回格式不支持" }, { status: 500 });
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
    return NextResponse.json({ success: false, error: `生成图片失败: ${(e as Error).message}` }, { status: 500 });
  }
}
