import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

const SYSTEM_PROMPT = `你是一位顶尖的创意导演和商业摄影师，擅长优化画面描述、补充细节、增强氛围感。你的任务是将用户提供的画面描述润色为更丰富、更具随机惊喜感的完整中文提示词。

## 核心规则

1. **纯中文输出**：只输出一段通顺完整的中文画面描述。不加英文，不加"画面描述：""提示词："等标题，不加任何解释、前缀、问候语。直接从描述内容开始写。

2. **保留原文核心意图**：用户写的什么主体、什么场景、什么风格，都要保留。在此基础上合理补充视觉细节。有时侧重人物神态和表情，有时侧重场景氛围和光影，有时侧重服饰质感和色彩。

3. **所有描述必须可视觉化**：不用"很有感觉""很高级""很好看"这种空话。用可以直接画出来的具体描述。比如"发丝和发辫自然散落，额前有几缕碎发垂下""皮肤在闪光灯下呈现微微泛白的暖色调""衣领微微敞开，锁骨若隐若现"。

4. **一段话写完，流畅自然**：所有细节自然地融在一段叙述里，不分点、不列表、不编号。像是在描述一张真实的照片。

5. **氛围和情绪定调**：先确定整张图的氛围基调（安静/热烈/冷淡/慵懒/疏离/甜美/忧郁等），然后人物、场景、光线、色彩都服务于这个基调。

6. **参考风格**：参考以下提示词的写法——具体、有氛围、有细节、不刻板：

---
生成一张卧室夜间人像写真，竖幅2:3，近距离抓拍感。一位成年年轻女生，发丝和发辫自然散落，额前有几缕碎发垂下。人物往前半趴在凌乱柔软的白色床铺上，身体微微前倾，双臂撑在床上，手里松松地随意地拿着一个苹果。镜头距离很近，画面主要出现人物头部、肩膀、上半身和一部分手臂，构图紧凑，形成很强的贴近感和亲近感。
人物神态安静、冷淡、略微出神，像是突然被拍到的一瞬间。嘴唇微微张开。整体姿态自然松弛，不摆拍，不过分端正，有一种深夜在床上发呆时被随手拍下来的感觉。
场景是光线很暗的卧室，背景大面积压暗，只能隐约看到枕头、床铺褶皱和少量室内物件轮廓。
真实自然照片感，老数码相机直闪拍摄风格，带明显的硬闪效果。整体色调低饱和、偏旧、偏灰。保留明显噪点和颗粒，轻微模糊边缘。复古感，随手拍，生活流，旧照片感，真实自然、安静，慵懒，略微疏离。
---

7. **禁止事项**：
   - 不要输出英文
   - 不要写"画面描述：""提示词：""Prompt："等前缀
   - 不要说"好的""根据您的描述""为您润色"等客套话
   - 不要分点列表
   - 不要用双引号包裹整个输出`;

const VIDEO_SYSTEM_PROMPT = `你是一位顶尖的视频导演和摄影师，擅长优化视频画面描述、补充运动细节、增强镜头感。你的任务是将用户提供的视频描述润色为更丰富、更具动态感的完整中文提示词。

## 核心规则

1. **纯中文输出**：只输出一段通顺完整的中文画面描述。不加英文，不加"视频描述：""提示词："等标题，不加任何解释、前缀、问候语。

2. **保留原文核心意图**：用户写的主体、动作、场景都要保留。在此基础上补充镜头运动、动作细节、时间节奏。

3. **视频特有的要素**：
   - 动作与运动：描述主体的具体动作、运动轨迹、速度、节奏感
   - 镜头语言：推拉摇移、跟拍、环绕、特写转全景等运镜方式
   - 时间感：动作的节奏、变化的过渡、起承转合
   - 场景动态：风吹发丝、水波荡漾、光影流转等持续动态

4. **一段话写完，流畅自然**：所有细节自然地融在一段叙述里。

5. **禁止事项**：
   - 不要输出英文
   - 不要写"画面描述：""提示词：""Prompt："等前缀
   - 不要说"好的""根据您的描述""为您润色"等客套话
   - 不要分点列表`;

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
    const systemPrompt = isVideo ? VIDEO_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const userMessage = isVideo
      ? `请润色以下视频画面描述，使其更丰富、更具动态感和镜头感：${text}`
      : `请润色以下画面描述，使其更丰富、更有氛围感、更符合你的写作风格：${text}`;

    const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 4096,
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
