#!/bin/bash
# 文生图工作室 - 一键启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/.server.log"
PORT=8080

# 检查是否已运行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if [ -d "/proc/$OLD_PID" ]; then
        echo "服务已在运行中 (PID: $OLD_PID)"
        echo "如需重启请先执行 ./stop.sh"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

# 检查端口占用
PORT_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
if [ -n "$PORT_PID" ]; then
    echo "端口 $PORT 已被进程 $PORT_PID 占用，请先执行 ./stop.sh"
    exit 1
fi

cd "$SCRIPT_DIR"

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "================================="
echo "  文生图工作室 - 启动中..."
echo "  端口: $PORT"
echo "  局域网: http://${LOCAL_IP:-<本机IP>}:$PORT"
echo "  本地:   http://localhost:$PORT"
echo "  日志:   $LOG_FILE"
echo "================================="

echo "清理并构建生产产物..."
rm -rf .next
npm run build > "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "构建失败，请查看日志: $LOG_FILE"
    exit 1
fi

setsid ./node_modules/.bin/next start -H 0.0.0.0 -p "$PORT" >> "$LOG_FILE" 2>&1 &
LAUNCH_PID=$!

echo -n "等待服务启动"
for i in $(seq 1 30); do
    sleep 1
    echo -n "."
    if curl -s -o /dev/null "http://localhost:$PORT" 2>/dev/null; then
        echo ""
        # 获取实际监听端口的 PID
        REAL_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
        if [ -z "$REAL_PID" ]; then
            REAL_PID=$LAUNCH_PID
        fi
        echo "$REAL_PID" > "$PID_FILE"
        echo "启动成功! PID: $REAL_PID"
        exit 0
    fi
done

kill "$LAUNCH_PID" 2>/dev/null
echo ""
echo "启动超时，请查看日志: $LOG_FILE"
exit 1
