export interface KeywordPresetGroup {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
}

export const legacyKeywordGroupSlugs = ["scene", "character", "style", "lighting", "composition"];

export const defaultKeywordGroups: KeywordPresetGroup[] = [
  {
    slug: "subject",
    name: "拍摄主体",
    description: "先明确镜头里拍谁，适合人像、商业和情绪片快速定向。",
    keywords: ["单人肖像", "情侣合影", "亲子互动", "闺蜜写真", "时尚模特", "运动人物", "旅行人物", "职业形象"],
  },
  {
    slug: "scene",
    name: "场景环境",
    description: "决定拍摄发生在哪里，优先使用摄影里常见的真实场景表达。",
    keywords: ["城市街头", "咖啡馆", "工作室", "酒店空间", "海边", "森林", "草地", "雪景"],
  },
  {
    slug: "lighting",
    name: "光线条件",
    description: "用容易理解的专业光线名词控制氛围和层次。",
    keywords: ["自然侧光", "逆光轮廓", "柔光箱布光", "窗边柔光", "黄金时刻", "蓝调时刻", "阴天漫射光", "霓虹混合光"],
  },
  {
    slug: "lens",
    name: "镜头与景别",
    description: "同时覆盖常见焦段和景别，方便快速控制压缩感与取景范围。",
    keywords: ["35mm 环境人像", "50mm 标准视角", "85mm 人像特写", "广角全景", "半身构图", "全身构图", "特写镜头", "近景特写"],
  },
  {
    slug: "composition",
    name: "机位与构图",
    description: "强调摄影常用的机位语言，而不是过于抽象的视觉词。",
    keywords: ["平视机位", "低机位仰拍", "高机位俯拍", "居中对称", "三分法构图", "留白构图", "引导线构图", "框景构图"],
  },
  {
    slug: "mood",
    name: "情绪氛围",
    description: "控制照片给人的情绪感受，适合和光线、场景组合使用。",
    keywords: ["清新通透", "电影感", "安静松弛", "浪漫氛围", "高级冷调", "温暖治愈", "都市感", "故事感"],
  },
  {
    slug: "styling",
    name: "造型与质感",
    description: "补充服装妆造和成片材质感，适合商业、人像、时尚方向。",
    keywords: ["极简穿搭", "通勤造型", "复古穿搭", "礼服造型", "日系妆面", "欧美妆感", "胶片颗粒", "高质感商业修图"],
  },
];
