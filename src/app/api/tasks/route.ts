import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, tasks, imageHistory } from "@/lib/db/schema";
import { eq, desc, or } from "drizzle-orm";

let startupCleaned = false;
function cleanupOrphanTasks() {
  if (startupCleaned) return;
  startupCleaned = true;
  try {
    const cleaning = db.select().from(tasks).where(eq(tasks.status, "processing")).all();
    if (cleaning.length > 0) {
      console.log(`[cleanup] 发现 ${cleaning.length} 个 processing 任务，标记为 failed`);
      db.update(tasks)
        .set({ status: "failed", progress: 0, error: "服务重启，任务中断，请重试", updatedAt: new Date().toISOString() })
        .where(eq(tasks.status, "processing"))
        .run();
    }
  } catch (e) {
    console.error("[cleanup] 孤儿任务清理失败:", e);
  }
}
try { cleanupOrphanTasks(); } catch {}
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

function parseReferenceImages(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {}
  return [value];
}

function isValidAgnesFrameCount(numFrames: number) {
  return numFrames > 0 && numFrames <= 441 && (numFrames - 1) % 8 === 0;
}

async function downloadFile(url: string, savePath: string): Promise<void> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error(`下载失败: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(savePath, buffer);
}

async function processImageTask(taskId: number, isImg2img: boolean) {
  const now = () => new Date().toISOString();
  try {
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) return;
    db.update(tasks).set({ status: "processing", progress: 5, updatedAt: now() }).where(eq(tasks.id, taskId)).run();

    let generatedPrompt = task.prompt.trim();

    if (!generatedPrompt) {
      const llmEndpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
      const llmApiKey = getConfig("llm_api_key");
      const llmModel = getConfig("llm_model") || "gpt-4o";

      if (!llmApiKey) throw new Error("请先配置 LLM API Key");

      const systemPrompt = `你是一位专业的${isImg2img ? "图片编辑" : "文生图"}提示词工程师。${isImg2img ? "用户上传了参考图并提供了编辑需求，请生成一条高质量的英文编辑提示词。" : "用户会提供一组关键词标签，请生成一条高质量的英文提示词。"}

核心规则：
1. 用英文输出
2. ${isImg2img ? "明确描述要修改什么、保留什么。参考图的整体结构、主体身份、姿态和构图应保持不变，只修改用户指定的属性（如服装、风格、光线、场景等）。" : "包含画面主体、环境/背景、光线、风格、构图、氛围等要素。"}
3. 适当添加画质增强词（highly detailed, 8k, masterpiece, professional photography, sharp focus 等）
4. 长度控制在 80-250 词之间
${isImg2img ? "" : `
画质与规范性要求（图片生成必须包含在提示词末尾）：
- perfect anatomy, anatomically correct, each body part clearly separated and distinct
- no merged limbs, no hands touching or resting on legs, no extra appendages
- correct number of fingers and toes, natural body proportions
- no deformities, no fused body parts
`}
输出格式：只输出提示词本身，不要加任何解释、引号、前缀或后缀，不要输出思考过程。`;

      const promptLabel = isImg2img ? "图片编辑需求" : "关键词标签";
      const userMessage = `${promptLabel}: ${task.keywordNames}。请生成一条专业的提示词，确保包含人体结构正确性要求。`;

      const promptUrl = llmEndpoint.replace(/\/+$/, "") + "/chat/completions";
      const promptRes = await fetch(promptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmApiKey}` },
        body: JSON.stringify({ model: llmModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.8, max_tokens: 2048, thinking: { type: "disabled" } }),
      });
      if (!promptRes.ok) throw new Error(`LLM 错误: ${await promptRes.text()}`);
      const promptData = await promptRes.json();
      generatedPrompt = promptData.choices?.[0]?.message?.content?.trim() || "";
      if (!generatedPrompt) throw new Error("生成提示词失败");

      db.update(tasks).set({ prompt: generatedPrompt, updatedAt: now() }).where(eq(tasks.id, taskId)).run();
    }

    const imageProvider = getConfig("image_provider") || "openai_image";
    const imgEndpoint = getConfig("image_endpoint") || "https://api.openai.com/v1";
    const imgApiKey = getConfig("image_api_key");
    const imgModel = getConfig("image_model") || (imageProvider === "agnes_image" ? "agnes-image-2.1-flash" : "gpt-image-1");
    const size = task.size || "1024x1024";

    if (!imgApiKey) throw new Error("请先配置生图 API Key");

    const qualitySuffix = ", perfect anatomy, each body part clearly separated and distinct, no merged limbs, no hands touching legs, no extra appendages, correct number of fingers and toes, natural body proportions, no deformities, professional photography, highly detailed, masterpiece";
    const img2imgPrefix = isImg2img
      ? "Edit the reference image: "
      : "";
    const finalPrompt = img2imgPrefix + generatedPrompt + qualitySuffix;

    const imgUrl = imgEndpoint.replace(/\/+$/, "") + "/images/generations";
    const reqBody: Record<string, unknown> = imageProvider === "agnes_image"
      ? { model: imgModel, prompt: finalPrompt, size, extra_body: { response_format: "url" } }
      : { model: imgModel, prompt: finalPrompt, size };

    if (isImg2img && task.referenceImage) {
      const referenceImages = parseReferenceImages(task.referenceImage);
      // Strip data URI prefix — some APIs only accept raw base64 or URL
      const cleaned = referenceImages.map((img) => {
        if (img.startsWith("data:image/")) {
          const b64 = img.split(",")[1];
          if (b64) {
            console.log(`[image#${taskId}] 参考图 data URI, base64 长度: ${b64.length}`);
            return b64;
          }
        }
        console.log(`[image#${taskId}] 参考图格式: ${img.substring(0, 60)}...`);
        return img;
      });

      if (imageProvider === "agnes_image") {
        if (!reqBody.extra_body) reqBody.extra_body = { response_format: "url" };
        (reqBody.extra_body as Record<string, unknown>).image = cleaned.length === 1 ? cleaned[0] : cleaned;
      } else {
        // gpt-image-1: send as array for multiple refs, string for single
        reqBody.image = cleaned.length === 1 ? cleaned[0] : cleaned;
      }

      console.log(`[image#${taskId}] img2img 请求体 (prompt缩写):`, JSON.stringify({ ...reqBody, prompt: (reqBody.prompt as string).substring(0, 80) + "..." }).substring(0, 400));
    }

    const imgRes = await fetch(imgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${imgApiKey}` },
      body: JSON.stringify(reqBody),
    });
    if (!imgRes.ok) {
      const errBody = await imgRes.text();
      console.error(`[image#${taskId}] 生图HTTP错误 ${imgRes.status}:`, errBody.substring(0, 500));
      throw new Error(`生图错误 (${imgRes.status}): ${errBody.substring(0, 200)}`);
    }
    const imgData = await imgRes.json();
    console.log(`[image#${taskId}] API响应:`, JSON.stringify(imgData).substring(0, 300));
    const imageResult = imgData.data?.[0];
    if (!imageResult) {
      const summary = JSON.stringify(imgData).substring(0, 300);
      console.error(`[image#${taskId}] 返回数据为空 data=`, summary);
      throw new Error(`生图返回数据为空。API 响应: ${summary}`);
    }

    const publicDir = path.join(process.cwd(), "public", "images", "generated");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const filename = `${uuidv4()}.png`;
    const savePath = path.join(publicDir, filename);

    if (imageResult.b64_json) {
      fs.writeFileSync(savePath, Buffer.from(imageResult.b64_json, "base64"));
    } else if (imageResult.url) {
      await downloadFile(imageResult.url, savePath);
    } else {
      throw new Error("返回格式不支持");
    }

    const imagePath = `/images/generated/${filename}`;

    db.insert(imageHistory).values({
      keywordNames: task.keywordNames,
      prompt: generatedPrompt,
      imagePath,
      type: "image",
    }).run();

    db.update(tasks).set({ status: "done", imagePath, progress: 100, updatedAt: now() }).where(eq(tasks.id, taskId)).run();
  } catch (e) {
    db.update(tasks).set({ status: "failed", progress: 0, error: (e as Error).message, updatedAt: new Date().toISOString() }).where(eq(tasks.id, taskId)).run();
  }
}

async function processVideoTask(taskId: number, width: number, height: number, numFrames: number, fps: number, videoMode: string) {
  const now = () => new Date().toISOString();
  try {
    const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) return;
    db.update(tasks).set({ status: "processing", progress: 1, updatedAt: now() }).where(eq(tasks.id, taskId)).run();

    const imgEndpoint = getConfig("image_endpoint") || "https://apihub.agnes-ai.com/v1";
    const apiKey = getConfig("image_api_key");
    const videoApiKey = getConfig("video_api_key") || apiKey;
    const videoEndpoint = getConfig("video_endpoint") || "https://apihub.agnes-ai.com";
    const videoModel = getConfig("video_model") || "agnes-video-v2.0";
    const baseUrl = videoEndpoint.replace(/\/+$/, "");
    const key = videoApiKey;

    if (!key) throw new Error("请先配置视频 API Key");
    if (!isValidAgnesFrameCount(numFrames)) throw new Error("视频帧数必须满足 8n + 1 且不超过 441");
    if (fps < 1 || fps > 60) throw new Error("视频帧率必须在 1 到 60 之间");

    let prompt = task.prompt || task.keywordNames;

    // Generate video-optimized prompt if using keywords (no manual prompt)
    if (!task.prompt && task.keywordNames) {
      const llmEndpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
      const llmApiKey = getConfig("llm_api_key");
      const llmModel = getConfig("llm_model") || "gpt-4o";
      if (llmApiKey) {
        const videoSystemPrompt = `你是一位专业的 AI 视频提示词工程师。用户会提供关键词或简短描述，请生成一条适合视频生成的英文提示词。

与图片不同，视频提示词应关注：
1. 动作与运动：描述主体的具体动作、运动轨迹、速度
2. 镜头语言：推拉摇移、跟拍、特写转全景等运镜方式
3. 时间感：动作的节奏、持续时间、变化过程
4. 场景动态：风吹、水流、光影变化等环境动态
5. 氛围与情绪：通过动作和镜头传递的情感

规则：
- 用英文输出
- 长度 80-200 词
- 不要包含人体结构要求（那是图片专用的）
- 只输出提示词本身`;

        const promptUrl = llmEndpoint.replace(/\/+$/, "") + "/chat/completions";
        const promptRes = await fetch(promptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmApiKey}` },
          body: JSON.stringify({ model: llmModel, messages: [{ role: "system", content: videoSystemPrompt }, { role: "user", content: `根据以下内容生成视频提示词：${task.keywordNames}` }], temperature: 0.8, max_tokens: 1024, thinking: { type: "disabled" } }),
        });
        if (promptRes.ok) {
          const promptData = await promptRes.json();
          const gp = promptData.choices?.[0]?.message?.content?.trim();
          if (gp) { prompt = gp; db.update(tasks).set({ prompt: gp, updatedAt: now() }).where(eq(tasks.id, taskId)).run(); }
        }
      }
    }

    const reqBody: Record<string, unknown> = {
      model: videoModel,
      prompt,
      height,
      width,
      num_frames: numFrames,
      frame_rate: fps,
    };

    const referenceImages = parseReferenceImages(task.referenceImage);
    if (referenceImages.length > 0) {
      if (referenceImages.some((image) => image.startsWith("data:"))) {
        throw new Error("视频参考图请使用公网 URL，Agnes 视频接口不支持本地 Base64 图片");
      }
      reqBody.image = referenceImages.length === 1 ? referenceImages[0] : referenceImages;
      reqBody.extra_body = { image: referenceImages };
      if (videoMode === "keyframes") {
        reqBody.mode = "keyframes";
        (reqBody.extra_body as Record<string, unknown>).mode = "keyframes";
      } else {
        reqBody.mode = "ti2vid";
      }
    }

    const createRes = await fetch(`${baseUrl}/v1/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(reqBody),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`[video#${taskId}] 创建失败: ${createRes.status}`, errText);
      throw new Error(`视频创建失败: ${errText}`);
    }
    const createData = await createRes.json();
    const videoId = createData.video_id;
    if (!videoId) {
      console.error(`[video#${taskId}] 创建返回无 video_id:`, JSON.stringify(createData));
      throw new Error("视频创建返回无 video_id");
    }
    console.log(`[video#${taskId}] 已创建, video_id=${videoId.substring(0, 20)}...`);

    db.update(tasks).set({ videoId, progress: 2, updatedAt: now() }).where(eq(tasks.id, taskId)).run();

    for (let i = 0; i < 360; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      let statusRes: Response;
      try {
        statusRes = await fetch(`${baseUrl}/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(videoModel)}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
      } catch (fetchErr) {
        console.log(`[video#${taskId}] 轮询网络错误 (第${i + 1}次):`, (fetchErr as Error).message);
        continue;
      }
      if (!statusRes.ok) {
        console.log(`[video#${taskId}] 轮询返回 ${statusRes.status} (第${i + 1}次)`);
        continue;
      }
      const statusData = await statusRes.json();
      const progress = statusData.progress ?? 0;
      console.log(`[video#${taskId}] 轮询第${i + 1}次: status=${statusData.status}, progress=${progress}%`);

      if (statusData.status === "completed") {
        const videoUrl = statusData.video_url || statusData.remixed_from_video_id || statusData.url;
        if (!videoUrl) throw new Error("视频完成但未返回下载链接");
        const publicDir = path.join(process.cwd(), "public", "videos", "generated");
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        const filename = `${uuidv4()}.mp4`;
        const savePath = path.join(publicDir, filename);
        await downloadFile(videoUrl, savePath);
        const videoPath = `/videos/generated/${filename}`;

        let posterPath = "";
        try {
          const posterFilename = filename.replace(".mp4", ".jpg");
          const posterSavePath = path.join(publicDir, posterFilename);
          const { execSync } = await import("child_process");
          execSync(`ffmpeg -y -i "${savePath}" -ss 0.5 -vframes 1 -q:v 2 "${posterSavePath}"`, { stdio: "pipe" });
          posterPath = `/videos/generated/${posterFilename}`;
          console.log(`[video#${taskId}] 海报生成: ${posterPath}`);
        } catch (posterErr) {
          console.log(`[video#${taskId}] 海报生成失败 (不影响视频):`, (posterErr as Error).message);
        }

        db.insert(imageHistory).values({
          keywordNames: task.keywordNames,
          prompt: prompt,
          imagePath: videoPath,
          type: "video",
          posterPath,
        }).run();

        db.update(tasks).set({ status: "done", videoPath, posterPath, progress: 100, updatedAt: now() }).where(eq(tasks.id, taskId)).run();
        console.log(`[video#${taskId}] 完成! 文件: ${videoPath}`);
        return;
      }
      if (statusData.status === "failed") {
        const errDetail = typeof statusData.error === "object" ? JSON.stringify(statusData.error) : String(statusData.error || "未知错误");
        throw new Error("视频生成失败: " + errDetail);
      }
      db.update(tasks).set({ progress: Math.max(2, Math.min(Number(progress) || 0, 99)), updatedAt: now() }).where(eq(tasks.id, taskId)).run();
    }
    throw new Error("视频生成超时（30分钟）");
  } catch (e) {
    db.update(tasks).set({ status: "failed", progress: 0, error: (e as Error).message, updatedAt: new Date().toISOString() }).where(eq(tasks.id, taskId)).run();
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { keywords, size, type, image, prompt: manualPrompt, width, height, num_frames, frame_rate, video_mode } = await request.json();
    if (!keywords && !manualPrompt) {
      return NextResponse.json({ success: false, error: "缺少关键词或提示词" }, { status: 400 });
    }

    const taskType = type || "image";
    if (taskType === "video") {
      const frames = Number(num_frames || 121);
      const fps = Number(frame_rate || 24);
      if (!isValidAgnesFrameCount(frames)) {
        return NextResponse.json({ success: false, error: "视频帧数必须满足 8n + 1 且不超过 441" }, { status: 400 });
      }
      if (fps < 1 || fps > 60) {
        return NextResponse.json({ success: false, error: "视频帧率必须在 1 到 60 之间" }, { status: 400 });
      }
    }

    const task = db.insert(tasks).values({
      status: "pending",
      type: taskType,
      keywordNames: keywords || manualPrompt || "",
      prompt: manualPrompt || "",
      referenceImage: Array.isArray(image) ? JSON.stringify(image) : image || "",
      size: size || "1024x1024",
    }).returning().get();

    if (taskType === "video") {
      processVideoTask(task.id, width || 1152, height || 768, num_frames || 121, frame_rate || 24, video_mode || "reference");
    } else {
      processImageTask(task.id, taskType === "img2img");
    }

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
