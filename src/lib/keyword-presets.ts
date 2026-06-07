export interface KeywordPresetGroup {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
}

export const legacyKeywordGroupSlugs = ["scene", "character", "style", "lighting", "composition"];
export const legacyOnlyKeywordGroupSlugs = ["character", "style", "clothing", "body-part"];

export const defaultKeywordGroups: KeywordPresetGroup[] = [
  {
    slug: "output-spec",
    name: "输出规格",
    description: "先定画幅和清晰度，避免后面构图和用途不匹配。",
    keywords: ["1:1 方图", "3:4 竖构图", "4:3 横构图", "9:16 竖屏海报", "16:9 宽银幕", "512 轻量预览", "1024 标准清晰", "1536 高清细节", "2048 商业精修"],
  },
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
    slug: "pose",
    name: "动作与姿态",
    description: "比单纯写姿势更接近摄影指导话术，适合人物片直接组合。",
    keywords: ["自然站姿", "坐姿放松", "回眸瞬间", "行走抓拍", "侧身停顿", "抬手整理头发", "双手互动", "动态转身"],
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
    description: "把服装、妆面和后期质感统一放在一组里，更符合实际拍摄表达。",
    keywords: ["极简穿搭", "通勤造型", "复古穿搭", "礼服造型", "日系妆面", "欧美妆感", "胶片颗粒", "高质感商业修图"],
  },
  {
    slug: "detail",
    name: "局部细节",
    description: "替代直白的身体部位标签，改成更适合摄影沟通的细节镜头语言。",
    keywords: ["眼神特写", "唇部细节", "手部动作", "发丝细节", "侧脸轮廓", "锁骨线条", "服装纹理", "配饰特写"],
  },
];
