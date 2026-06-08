import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getConfig(key: string): string {
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value || "";
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const targetMap: Record<string, { endpoint: string; apiKey: string; label: string; provider?: string }> = {
      llm: { endpoint: "llm_endpoint", apiKey: "llm_api_key", label: "LLM" },
      image: { endpoint: "image_endpoint", apiKey: "image_api_key", label: "生图", provider: getConfig("image_provider") || "openai_image" },
      video: { endpoint: "video_endpoint", apiKey: "video_api_key", label: "视频", provider: getConfig("video_provider") || "agnes_video" },
    };
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target") || "llm";
    const field = targetMap[target];

    if (!field) {
      return NextResponse.json({ success: false, error: "未知模型类型" }, { status: 400 });
    }

    const endpoint = getConfig(field.endpoint);
    const apiKey = getConfig(field.apiKey) || (target === "video" ? getConfig("image_api_key") : "");

    if (!endpoint || !apiKey) {
      return NextResponse.json({ success: false, error: `请先配置 ${field.label} 端点和 API Key` }, { status: 400 });
    }

    const baseUrl = endpoint.replace(/\/+$/, "");
    const url = field.provider === "agnes_video"
      ? `${baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/models`
      : `${baseUrl}/models`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `模型列表获取失败: ${await response.text()}` }, { status: 500 });
    }

    const data = await response.json();
    const models = (data.data || [])
      .map((model: { id?: string }) => model.id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      .sort((a: string, b: string) => a.localeCompare(b));

    return NextResponse.json({ success: true, data: models });
  } catch (e) {
    if ((e as Error).message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "模型列表获取失败" }, { status: 500 });
  }
}
