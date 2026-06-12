import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, keywordGroups, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { defaultKeywordGroups, keywordNameMeta } from "@/lib/keyword-presets";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

const SYSTEM_PROMPT = `你是一位顶尖的创意导演和商业摄影师，擅长从关键词卡片生成有氛围感、有随机惊喜的画面描述。你的任务是根据用户选择的分类关键词，生成一段可直接用于生图的中文提示词。

## 核心规则

1. **纯中文输出**：只输出一段通顺完整的中文画面描述。不加英文，不加"画面描述：""提示词："等标题，不加任何解释、前缀、问候语。直接从描述内容开始写。

2. **灵活填充，每次不一样**：根据关键词类别（主体、环境、穿着、姿势、拍摄方式、风格等）展开合理想象，填充具体的视觉细节。但**不是每次都必须填满所有维度**——有时侧重人物神态和表情，有时侧重场景氛围和光影，有时侧重服饰质感和色彩。每次的侧重方向可以变化，让输出有抽卡随机感。

3. **所有描述必须可视觉化**：不用"很有感觉""很高级""很好看"这种空话。用可以直接画出来的具体描述。比如"发丝和发辫自然散落，额前有几缕碎发垂下""皮肤在闪光灯下呈现微微泛白的暖色调""衣领微微敞开，锁骨若隐若现"。

4. **一段话写完，流畅自然**：所有细节自然地融在一段叙述里，不分点、不列表、不编号。像是在描述一张真实的照片，而不是在列清单。

5. **氛围和情绪定调**：先确定整张图的氛围基调（安静/热烈/冷淡/慵懒/疏离/甜美/忧郁等），然后人物、场景、光线、色彩都服务于这个基调，让整体有统一的情感色彩。

6. **输出参数自然融入**：如果用户选了比例或清晰度的关键词，在开头以画面语言自然带出，如"竖幅2:3，近距离抓拍感""横版宽幅，大场景展开""方形构图，证件照式居中对正"。不要写"输出参数：比例3:4"这种生硬写法。

7. **参考风格**：参考以下提示词的写法——具体、有氛围、有细节、不刻板：

---
生成一张卧室夜间人像写真，竖幅2:3，近距离抓拍感。一位成年年轻女生，发丝和发辫自然散落，额前有几缕碎发垂下。人物往前半趴在凌乱柔软的白色床铺上，身体微微前倾，双臂撑在床上，手里松松地随意地拿着一个苹果。镜头距离很近，画面主要出现人物头部、肩膀、上半身和一部分手臂，构图紧凑，形成很强的贴近感和亲近感。
人物神态安静、冷淡、略微出神，像是突然被拍到的一瞬间。嘴唇微微张开。整体姿态自然松弛，不摆拍，不过分端正，有一种深夜在床上发呆时被随手拍下来的感觉。
场景是光线很暗的卧室，背景大面积压暗，只能隐约看到枕头、床铺褶皱和少量室内物件轮廓。床单和枕头是偏冷白色或灰白色，带柔软褶皱。整体空间安静、昏暗，体现卧室的夜晚环境。
真实自然照片感，老数码相机直闪拍摄风格，带明显的硬闪效果。闪光灯从镜头正面直接打在人物脸部、肩膀、手臂和床单上，使皮肤和白色布料形成突出的亮面，和背景的黑色形成鲜明对比。复古数码感、轻微失焦感、轻微拖影感和颗粒噪点，像早期卡片机、旧 CCD、低像素夜拍照片。禁止商业棚拍感，禁止高清锐利写真感，禁止精修海报感，禁止AI精致感。
整体色调低饱和、偏旧、偏灰，主色为黑色的长发、冷白床单、奶白肤色、黑灰背景。皮肤在闪光灯下呈现微微泛白的暖色调。整张图冷暖自然混合。
保留明显噪点和颗粒，轻微模糊边缘，轻微曝光不均，轻微脏感和旧照片感。自然肤质。头发要有真实发丝感，但整体成像。复古感，随手拍，生活流，旧照片感，真实自然、安静，慵懒，略微疏离。

---

8. **安全合规指南（极其重要）**：
   你的输出会被送入图像生成模型，该模型有严格的安全策略。为避免生成被拒绝，你必须遵循以下准则：

   a. **自然遮挡**：当描述身体部位时，利用以下手法让画面自然且安全：
      - 手部或手指自然放在身前、插兜、整理头发、拿物品
      - 配饰（项链、丝巾、围巾）自然垂落，形成视觉遮挡
      - 被单、毯子、衣物褶皱、窗帘自然覆盖，只露出肩膀以上
      - 光线从侧面或背后打来，形成柔和的高光与阴影，使身体线条呈现而非细节暴露
      - 浅景深虚化腰部以下，焦点集中在面部和手部

   b. **安全构图**：
      - 首选半身以上、面部特写、背影、侧影、剪影
      - 人物可以面对镜头，但身体自然倾斜或侧转
      - 避免仰角拍摄、避免镜头直接对准躯干中央
      - 多利用前景元素（花草、窗框、纱帘、玻璃反光）形成画框式遮挡

   c. **安全用词替换**：
      - 不直接描写身体裸露程度，改为"衣着得体的""穿着完整的"
      - 不描写紧身或透明服装，改为"宽松的""垂坠感的"
      - 不描写带有暗示性的姿势，改为"放松的""自然的""不经意的"
      - 需要表现曲线时，用"服装的褶皱和垂坠自然勾勒出优雅的轮廓"

   d. **绝对禁忌**：
      - 不要描写裸露、透明、透视装、内衣外穿
      - 不要写"裸露""暴露""若隐若现""半透明""贴身""紧身勾勒"
      - 不要描写暗示性的姿势、眼神、神态
      - 不要描写任何涉及浴缸、淋浴、床上的暴露姿态

9. **禁止事项**：
   - 不要输出英文
   - 不要写"画面描述：""提示词：""Prompt：""英文提示词："等前缀
   - 不要说"好的""根据您的关键词""为您生成"等客套话
   - 不要分点列表
   - 不要写两段话（中文一段+英文一段），只写一段中文
   - 不要用双引号包裹整个输出
   - 不要写"素材类型""主体""场景/背景"等分类标题`;

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const rawKeywords: unknown[] = body.keywords;
    const reqMode = (body.mode as string) || "keywords";

    if (!rawKeywords || !Array.isArray(rawKeywords) || rawKeywords.length === 0) {
      return NextResponse.json({ success: false, error: "请选择至少一个关键词" }, { status: 400 });
    }

    // Accept both {name, groupSlug, facetSlug} objects and plain strings (backward compat)
    const keywordItems: Array<{ name: string; groupSlug: string | null; facetSlug: string | null }> = rawKeywords.map((kw) => {
      if (typeof kw === "string") return { name: kw, groupSlug: null, facetSlug: null };
      if (typeof kw === "object" && kw !== null && "name" in kw) {
        return {
          name: String((kw as Record<string, unknown>).name),
          groupSlug: (kw as Record<string, unknown>).groupSlug as string | null,
          facetSlug: ((kw as Record<string, unknown>).facetSlug as string | null) || null,
        };
      }
      return { name: String(kw), groupSlug: null, facetSlug: null };
    });

    // If no groupSlugs provided, look them up from DB
    const needsGroupLookup = keywordItems.some((kw) => !kw.groupSlug);
    let keywordNameToGroupSlug: Map<string, string> | null = null;

    if (needsGroupLookup) {
      const allGroups = db.select().from(keywordGroups).all();
      keywordNameToGroupSlug = new Map<string, string>();
      for (const group of allGroups) {
        const kws = db.select().from(keywords).where(eq(keywords.groupId, group.id)).all();
        for (const kw of kws) {
          keywordNameToGroupSlug.set(kw.name, group.slug);
        }
      }
    }

    // Group keywords by category slug
    const grouped: Map<string, string[]> = new Map();
    const presetNames = new Map(defaultKeywordGroups.map((g) => [g.slug, g.name]));

    for (const item of keywordItems) {
      const slug = item.groupSlug || keywordNameToGroupSlug?.get(item.name) || keywordNameMeta.get(item.name)?.groupSlug || "unknown";
      if (slug === "output") continue;
      if (!grouped.has(slug)) grouped.set(slug, []);
      grouped.get(slug)!.push(item.name);
    }

    // Build structured user message
    const isImg2img = reqMode === "img2img";
    let userMessage: string;

    if (isImg2img && grouped.size === 0) {
      // img2img with no keywords — generate generic edit instruction
      userMessage = "用户上传了参考图但未选择关键词。请生成一段通用的图片编辑提示词，描述可以对画面做哪些优化，如提升画质、调整光线、增强色彩、优化构图等。保持原图的整体结构和主体不变。";
    } else if (isImg2img) {
      userMessage = "用户上传了参考图，请根据以下分类关键词生成一段**编辑指令式**的画面描述。注意：不是描述一张新图，而是描述在参考图基础上要修改什么、保留什么。\n\n";
      for (const [slug, kws] of grouped) {
        const label = presetNames.get(slug) || slug;
        userMessage += `【${label}】${kws.join("、")}\n`;
      }
    } else {
      userMessage = "请根据以下分类关键词生成详细画面描述:\n\n";
      for (const [slug, kws] of grouped) {
        const label = presetNames.get(slug) || slug;
        userMessage += `【${label}】${kws.join("、")}\n`;
      }
    }

    const outputKeywords = keywordItems.filter((item) => (item.groupSlug || keywordNameMeta.get(item.name)?.groupSlug) === "output").map((item) => item.name);
    if (outputKeywords.length > 0) {
      userMessage += `【输出参数】${outputKeywords.join("、")}\n`;
    }

    const endpoint = getConfig("llm_endpoint") || "https://api.openai.com/v1";
    const apiKey = getConfig("llm_api_key");
    const model = getConfig("llm_model") || "gpt-4o";

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "请先在后台配置 LLM API Key" }, { status: 400 });
    }

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 4096,
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ success: false, error: `LLM API 错误: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return NextResponse.json({ success: false, error: "生成提示词失败,模型未返回有效内容" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { prompt: raw },
    });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: `生成失败: ${(e as Error).message}` }, { status: 500 });
  }
}
