#!/bin/bash
# 文生图工作室 - 一键停止脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
PORT=8080

# 方法1: 通过 PID 文件停止
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if [ -d "/proc/$PID" ]; then
        echo "正在停止服务 (PID: $PID)..."
        kill "$PID" 2>/dev/null
        sleep 1
        [ -d "/proc/$PID" ] && kill -9 "$PID" 2>/dev/null
    fi
    rm -f "$PID_FILE"
fi

# 方法2: 通过端口兜底清理残留
sleep 1
PORT_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
if [ -n "$PORT_PID" ]; then
    echo "清理端口 $PORT 残留进程 (PID: $PORT_PID)..."
    kill "$PORT_PID" 2>/dev/null
    sleep 1
    kill -9 "$PORT_PID" 2>/dev/null
fi

echo "服务已停止"
