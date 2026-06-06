import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, tasks, imageHistory } from "@/lib/db/schema";
import { eq, desc, sql, or } from "drizzle-orm";
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

async function processTask(taskId: number) {
  const now = () => new Date().toISOString();
  try {
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) return;

    db.update(tasks).set({ status: "processing", updatedAt: now() }).where(eq(tasks.id, taskId)).run();

    const llmEndpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
    const llmApiKey = getConfig("llm_api_key");
    const llmModel = getConfig("llm_model") || "gpt-4o";

    if (!llmApiKey) throw new Error("请先在后台配置 LLM API Key");

    const systemPrompt = `你是一位专业的文生图提示词工程师。用户会提供一组关键词标签，请根据这些标签生成一条高质量的英文文生图提示词。

核心规则（必须遵守）：
1. 用英文输出
2. 包含画面主体、环境/背景、光线、风格、构图、氛围等要素
3. 适当添加画质增强词（highly detailed, 8k, masterpiece, professional photography, sharp focus 等）
4. 长度控制在 80-250 词之间

画质与规范性要求（必须包含在提示词末尾）：
- perfect anatomy, anatomically correct, each body part clearly separated and distinct
- no merged limbs, no hands touching or resting on legs, no extra appendages
- correct number of fingers and toes, natural body proportions
- no deformities, no fused body parts, no extra limbs emerging from wrong places
- if hands are visible, they must be separate from legs and other body parts

输出格式：只输出提示词本身，不要加任何解释、引号、前缀或后缀，不要输出思考过程。`;

    const userMessage = `关键词标签: ${task.keywordNames}。请生成一条专业的文生图提示词，确保包含人体结构正确性要求。`;

    const promptUrl = llmEndpoint.replace(/\/+$/, "") + "/chat/completions";
    const promptRes = await fetch(promptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmApiKey}` },
      body: JSON.stringify({ model: llmModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.8, max_tokens: 2048, thinking: { type: "disabled" } }),
    });
    if (!promptRes.ok) throw new Error(`LLM 错误: ${await promptRes.text()}`);
    const promptData = await promptRes.json();
    const generatedPrompt = promptData.choices?.[0]?.message?.content?.trim();
    if (!generatedPrompt) throw new Error("生成提示词失败，模型返回为空");

    db.update(tasks).set({ prompt: generatedPrompt, updatedAt: now() }).where(eq(tasks.id, taskId)).run();

    const imgEndpoint = getConfig("image_endpoint") || "https://api.openai.com/v1";
    const imgApiKey = getConfig("image_api_key");
    const imgModel = getConfig("image_model") || "dall-e-3";
    const size = task.size || "1024x1024";

    if (!imgApiKey) throw new Error("请先在后台配置生图 API Key");

    const qualitySuffix = ", perfect anatomy, anatomically correct, each body part clearly separated and distinct, no merged limbs, no hands touching legs, no extra appendages, correct number of fingers and toes, natural body proportions, no deformities, professional photography, highly detailed, masterpiece";
    const finalPrompt = generatedPrompt + qualitySuffix;

    const imgUrl = imgEndpoint.replace(/\/+$/, "") + "/images/generations";
    const imgRes = await fetch(imgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${imgApiKey}` },
      body: JSON.stringify({ model: imgModel, prompt: finalPrompt, n: 1, size, extra_body: { response_format: "url" } }),
    });
    if (!imgRes.ok) throw new Error(`生图错误: ${await imgRes.text()}`);
    const imgData = await imgRes.json();
    const imageResult = imgData.data?.[0];
    if (!imageResult) throw new Error("生图返回数据为空");

    const publicDir = path.join(process.cwd(), "public", "images", "generated");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const filename = `${uuidv4()}.png`;
    const savePath = path.join(publicDir, filename);

    if (imageResult.b64_json) {
      fs.writeFileSync(savePath, Buffer.from(imageResult.b64_json, "base64"));
    } else if (imageResult.url) {
      await downloadImage(imageResult.url, savePath);
    } else {
      throw new Error("生图返回格式不支持");
    }

    const imagePath = `/images/generated/${filename}`;

    db.insert(imageHistory).values({
      keywordNames: task.keywordNames,
      prompt: generatedPrompt,
      imagePath,
    }).run();

    db.update(tasks).set({ status: "done", imagePath, updatedAt: now() }).where(eq(tasks.id, taskId)).run();
  } catch (e) {
    const errMsg = (e as Error).message;
    db.update(tasks).set({ status: "failed", error: errMsg, updatedAt: now() }).where(eq(tasks.id, taskId)).run();
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { keywords, size } = await request.json();
    if (!keywords) {
      return NextResponse.json({ success: false, error: "缺少关键词或提示词" }, { status: 400 });
    }

    const task = db.insert(tasks).values({
      status: "pending",
      keywordNames: keywords,
      size: size || "1024x1024",
    }).returning().get();

    processTask(task.id);

    return NextResponse.json({ success: true, data: { taskId: task.id } });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "创建任务失败" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let result;
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        result = db.select().from(tasks).where(eq(tasks.status, statuses[0])).orderBy(desc(tasks.createdAt)).all();
      } else {
        result = db.select().from(tasks).where(or(...statuses.map((s) => eq(tasks.status, s)))).orderBy(desc(tasks.createdAt)).all();
      }
    } else {
      result = db.select().from(tasks).orderBy(desc(tasks.createdAt)).all();
    }

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "获取任务失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "缺少id" }, { status: 400 });
    db.delete(tasks).where(eq(tasks.id, Number(id))).run();
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "删除失败" }, { status: 500 });
  }
}
