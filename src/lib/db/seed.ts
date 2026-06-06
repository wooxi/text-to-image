import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const sqlite = new Database(path.join(process.cwd(), "data", "text-to-image.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS keyword_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES keyword_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS image_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_names TEXT NOT NULL,
    prompt TEXT NOT NULL,
    image_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const defaultConfigs: Record<string, string> = {
  llm_endpoint: "https://api.openai.com/v1",
  llm_api_key: "",
  llm_model: "gpt-4o",
  image_endpoint: "https://api.openai.com/v1",
  image_api_key: "",
  image_model: "dall-e-3",
  image_size: "1024x1024",
};

const insertConfig = sqlite.prepare(
  "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)"
);
for (const [key, value] of Object.entries(defaultConfigs)) {
  insertConfig.run(key, value);
}

const defaultKeywordGroups = [
  {
    slug: "scene",
    name: "场景",
    keywords: ["户外", "室内", "城市", "自然", "海边", "森林", "沙漠", "雪山", "草原", "星空"],
  },
  {
    slug: "character",
    name: "人物",
    keywords: ["美女", "儿童", "老人", "情侣", "群体", "独行者", "舞者", "运动员"],
  },
  {
    slug: "style",
    name: "风格",
    keywords: ["写实", "油画", "水彩", "赛博朋克", "古风", "动漫", "素描", "水墨", "复古", "极简"],
  },
  {
    slug: "lighting",
    name: "光线",
    keywords: ["黄金时刻", "蓝色时刻", "逆光", "柔光", "霓虹", "烛光", "阴天", "日光"],
  },
  {
    slug: "composition",
    name: "构图",
    keywords: ["特写", "全身", "半身", "俯拍", "仰拍", "对称", "三分法", "引导线"],
  },
];

const insertGroup = sqlite.prepare(
  "INSERT OR IGNORE INTO keyword_groups (name, slug) VALUES (?, ?)"
);
const insertKeyword = sqlite.prepare(
  "INSERT OR IGNORE INTO keywords (group_id, name) SELECT id, ? FROM keyword_groups WHERE slug = ?"
);

const insertGroups = sqlite.transaction(() => {
  for (const group of defaultKeywordGroups) {
    insertGroup.run(group.name, group.slug);
    for (const kw of group.keywords) {
      insertKeyword.run(kw, group.slug);
    }
  }
});
insertGroups();

const existingAdmin = sqlite
  .prepare("SELECT id FROM users WHERE username = ?")
  .get("admin") as { id: number } | undefined;

if (!existingAdmin) {
  const hash = bcrypt.hashSync("admin123", 10);
  sqlite.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
    "admin",
    hash
  );
  console.log("Default admin user created: admin / admin123");
}

console.log("Database seeded successfully.");
sqlite.close();
