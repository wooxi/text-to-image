"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("admin_user", data.data.username);
        router.push("/admin");
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="bg-app-bg2 border border-app-border rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-app-text text-center mb-6">后台登录</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-app-text3 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text focus:outline-none text-sm"
              style={{ outlineColor: "var(--accent)" }}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs text-app-text3 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text focus:outline-none text-sm"
              style={{ outlineColor: "var(--accent)" }}
              placeholder="输入密码"
            />
          </div>
          {error && <p className="text-app-danger text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-white rounded-lg transition text-sm"
            style={{
              background: loading ? "var(--bg-tertiary)" : "var(--accent)",
              color: loading ? "var(--text-muted)" : "#fff",
            }}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="text-xs text-app-text3 text-center mt-4">
          默认账号: admin / admin123
        </p>
      </div>
    </div>
  );
}
