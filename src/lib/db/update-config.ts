import Database from "better-sqlite3";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "data", "text-to-image.db"));

const configs: Record<string, string> = {
  llm_endpoint: "http://192.168.100.4:8030/v1",
  llm_api_key: "sk-xxbtN694lmzolOd4gPGLoREzYrwLroLxzhjZ3oD0wJ8D1C75",
  llm_model: "deepseek-v4-pro",
  image_endpoint: "https://apihub.agnes-ai.com/v1",
  image_api_key: "sk-QpPm6eIJkKBo8jgXsLbrO70XSWbhMCuCLK7fhDapuA7w6jJN",
  image_model: "agnes-image-2.1-flash",
  image_size: "1024x1024",
};

const upsert = sqlite.prepare(
  "INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
);

for (const [key, value] of Object.entries(configs)) {
  upsert.run(key, value);
}

console.log("数据库配置已更新:");
for (const [key, value] of Object.entries(configs)) {
  const displayVal = key.includes("key") ? value.slice(0, 20) + "..." : value;
  console.log(`  ${key}: ${displayVal}`);
}

sqlite.close();
