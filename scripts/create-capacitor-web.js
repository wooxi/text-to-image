const fs = require("fs");
const path = require("path");

const outDir = path.join(process.cwd(), "out");
fs.mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>AI 文生图</title>
    <style>
      :root {
        --bg: #111111;
        --panel: #1d1d1d;
        --panel-2: #262626;
        --text: #f5f1ea;
        --muted: #a79f93;
        --accent: #db6f35;
        --border: #343434;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        background:
          radial-gradient(circle at top, rgba(219,111,53,.25), transparent 30%),
          linear-gradient(180deg, #181512 0%, var(--bg) 55%);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(100%, 460px);
        background: rgba(29,29,29,.92);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 24px 64px rgba(0,0,0,.28);
      }
      h1 {
        margin: 0;
        font-size: 24px;
      }
      p {
        color: var(--muted);
        line-height: 1.6;
      }
      label {
        display: block;
        margin: 16px 0 8px;
        font-size: 13px;
        color: var(--muted);
      }
      input {
        width: 100%;
        height: 48px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--panel-2);
        color: var(--text);
        font-size: 15px;
      }
      button {
        width: 100%;
        height: 48px;
        margin-top: 16px;
        border: 0;
        border-radius: 14px;
        background: var(--accent);
        color: white;
        font-size: 15px;
        font-weight: 600;
      }
      .secondary {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
      }
      .tips {
        margin-top: 18px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,.03);
        font-size: 13px;
      }
      .status {
        margin-top: 10px;
        min-height: 20px;
        font-size: 13px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>AI 文生图</h1>
      <p>首次安装后，请输入可访问的服务地址。保存后将直接进入 Web 工作台，后续会自动记住。</p>
      <label for="server-url">服务地址</label>
      <input id="server-url" placeholder="例如：http://192.168.1.10:8080" />
      <button id="save-btn">保存并进入</button>
      <button id="open-btn" class="secondary">直接打开已保存地址</button>
      <div id="status" class="status"></div>
      <div class="tips">
        提示：
        <br />1. 请确保手机与服务端网络可达。
        <br />2. 地址需包含协议，如 <code>http://</code> 或 <code>https://</code>。
      </div>
    </main>
    <script>
      const key = "app_server_url";
      const input = document.getElementById("server-url");
      const status = document.getElementById("status");
      const saved = localStorage.getItem(key) || "";
      if (saved) input.value = saved;

      function openSavedUrl() {
        const value = input.value.trim();
        if (!/^https?:\\/\\//i.test(value)) {
          status.textContent = "请输入完整地址，必须带 http:// 或 https://";
          return;
        }
        localStorage.setItem(key, value);
        status.textContent = "正在打开服务地址...";
        window.location.href = value;
      }

      document.getElementById("save-btn").addEventListener("click", openSavedUrl);
      document.getElementById("open-btn").addEventListener("click", () => {
        const value = localStorage.getItem(key) || input.value.trim();
        if (!value) {
          status.textContent = "还没有保存服务地址。";
          return;
        }
        input.value = value;
        openSavedUrl();
      });

      if (saved) {
        status.textContent = "已保存地址：" + saved;
      }
    </script>
  </body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
