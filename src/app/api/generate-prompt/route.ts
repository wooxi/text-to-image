import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config, keywordGroups, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { defaultKeywordGroups } from "@/lib/keyword-presets";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

const SYSTEM_PROMPT = `你是一位顶级商业摄影制片人兼 AI 图像提示词专家。你的任务是根据用户选择的分类关键词，撰写一段极其详细的中文画面描述，并附一段可直接用于生图的英文提示词。

## 关键词分类含义
用户的关键词按以下维度组织（你应根据分类理解每个词的用途，不要混淆维度）：

| 分类 | 说明 | 典型词例 |
|------|------|----------|
| 主体属性 | 人数、性别、年龄、种族、发型、身份标签 | 单人、女性、长发、年轻、模特 |
| 图片风格 | 整体画风流派 | 写实摄影、日漫风格、3D 渲染 |
| 场景环境 | 拍摄地点和背景 | 卧室、咖啡店、城市街头 |
| 镜头与景别 | 焦段和取景范围 | 85mm、半身、面部特写 |
| 光线 | 光源类型和质地 | 侧光、逆光、柔光、窗边光 |
| 构图与机位 | 相机角度和构图方式 | 仰拍、三分法、居中构图 |
| 动作与姿态 | 人物在做什么 | 站立、低头、看镜头 |
| 服装与配饰 | 具体衣着和配件 | 白衬衫、牛仔裤、眼镜 |
| 妆发与质感 | 妆面、发型、成片质感 | 红唇、湿发、胶片颗粒 |
| 情绪气质 | 画面情绪基调 | 冷淡、温柔、慵懒、安静 |
| 局部细节 | 需要特别刻画的部位 | 眼神、锁骨、手指 |
| 输出规格 | 画幅比例和分辨率 | 3:4、1024、2048 |

## 输出要求

**禁止输出任何问候语、客套话、确认语、前缀说明。直接从「素材类型」开始，不要写"好的""查收""根据您的关键词"之类的废话。**

你必须严格按照以下格式输出，每个字段都必须有实质内容（缺关键词的维度要合理发挥）：

---

**素材类型**：一句话说明这是什么类型的图片（如：竖屏写实人像、横版商品广告、方形头像等）

**主体**：详细描述人物的年龄、性别、种族、外貌特征、发型、服装、配饰。要求具体、可视化，不写笼统形容词。例子写法："20 多岁的东亚女性，黑色长发自然散落，穿着奶油白无袖上衣和炭灰高腰长裤，银色耳饰，自然唇色"。

**场景/背景**：具体描述画面中的环境、背景物体、空间结构、景深关系。

**姿势/构图**：描述人物的身体姿态、四肢位置、与镜头的相对关系、构图方式。

**镜头/景别**：说明焦段、取景范围、视角高度。

**光线/氛围**：描述光源方向、光质（硬/柔）、色温、整体氛围感。

**风格/介质**：摄影风格、后期质感、画风流派。

**色彩搭配**：列出主导色彩和辅助色，如"草莓粉、奶油白、不锈钢灰"。

**纹理/质感**：画面中重要的材质和纹理，如"真实皮肤质感、光泽塑料、湿地面反光"。

**约束条件**：必须遵守的底线要求，如"保持面部可见、无水印、无 Logo、无文字、正常人体比例、无畸形"。

---

英文提示词：
(将上述中文描述忠实地翻译并改写为一段 150-350 词的英文提示词，必须覆盖中文描述中主体、场景、姿势、构图、镜头、光线、风格、色彩、纹理、约束等所有维度，不能因为语言切换就丢失信息。必须包含 anatomy quality terms：perfect anatomy, correct proportions, no deformities。不要缩写关键描述，不要用短句草草概括。适合直接输入生图模型。)

## 写作规范
- 全部用中文写主体部分，不要中英混杂
- 每个维度至少 2 句话，不要跳过任何维度
- 用可视觉化的具体名词和形容词，不用"很有感觉""很高级"这种空话
- 服装、发型、场景、光线的描述要精确到可以直接画出来
- 如果用户没选某个维度的关键词，请根据其他已选关键词合理推断补充，不要留空
- 约束条件段必须包含：正常人体比例、无畸形、无水印、无 Logo
- 英文提示词要完整覆盖中文描述的所有维度，不能只挑几个重点写。场景、光线、质感这些维度中文写了英文也必须写进去。`;

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const rawKeywords: unknown[] = body.keywords;

    if (!rawKeywords || !Array.isArray(rawKeywords) || rawKeywords.length === 0) {
      return NextResponse.json({ success: false, error: "请选择至少一个关键词" }, { status: 400 });
    }

    // Accept both {name, groupSlug} objects and plain strings (backward compat)
    const keywordItems: Array<{ name: string; groupSlug: string | null }> = rawKeywords.map((kw) => {
      if (typeof kw === "string") return { name: kw, groupSlug: null };
      if (typeof kw === "object" && kw !== null && "name" in kw) {
        return { name: String((kw as Record<string, unknown>).name), groupSlug: (kw as Record<string, unknown>).groupSlug as string | null };
      }
      return { name: String(kw), groupSlug: null };
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
      const slug = item.groupSlug || keywordNameToGroupSlug?.get(item.name) || "unknown";
      if (!grouped.has(slug)) grouped.set(slug, []);
      grouped.get(slug)!.push(item.name);
    }

    // Build structured user message
    let userMessage = "请根据以下分类关键词生成详细画面描述：\n\n";
    for (const [slug, kws] of grouped) {
      const label = presetNames.get(slug) || slug;
      userMessage += `【${label}】${kws.join("、")}\n`;
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
        temperature: 0.8,
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
      return NextResponse.json({ success: false, error: "生成提示词失败，模型未返回有效内容" }, { status: 500 });
    }

    // Split Chinese description and English prompt
    const englishMarker = "英文提示词：";
    const englishMarkerAlt = "English Prompt:";
    const englishMarkerAlt2 = "\n英文提示词";

    let chinese = raw;
    let english = "";

    const engIdx =
      raw.indexOf(englishMarker) !== -1 ? raw.indexOf(englishMarker) :
      raw.indexOf(englishMarkerAlt) !== -1 ? raw.indexOf(englishMarkerAlt) :
      raw.indexOf(englishMarkerAlt2) !== -1 ? raw.indexOf(englishMarkerAlt2) :
      -1;

    if (engIdx !== -1) {
      chinese = raw.substring(0, engIdx).trim();
      english = raw.substring(engIdx).replace(/^(英文提示词[：:]\s*|English Prompt[：:]\s*)/i, "").trim();
    } else {
      // Fallback: use whole output as both
      english = raw;
    }

    return NextResponse.json({
      success: true,
      data: {
        chinese,
        english,
        chineseLength: chinese.length,
        englishLength: english.split(/\s+/).length,
      },
    });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: `生成失败: ${(e as Error).message}` }, { status: 500 });
  }
}
