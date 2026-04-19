#!/bin/bash
set -e

: "${LLM_API_KEY:?LLM_API_KEY is required}"
: "${LLM_MODEL:?LLM_MODEL is required}"
: "${LLM_PROVIDER:=OPENROUTER}"

API_SERVER_KEY="${API_SERVER_KEY:-tryskills-session-$(date +%s)}"
WEBUI_PASSWORD="${WEBUI_PASSWORD:-}"

cat > /root/.hermes/.env << EOF
${LLM_PROVIDER}_API_KEY=${LLM_API_KEY}
LLM_MODEL=${LLM_MODEL}
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=${API_SERVER_KEY}
API_SERVER_CORS_ORIGINS=*
EOF

cat > /root/.hermes/config.yaml << EOF
model: ${LLM_MODEL}
terminal:
  backend: local
agent:
  max_iterations: 50
approvals:
  mode: yolo
EOF

hermes gateway &
GATEWAY_PID=$!

export HERMES_WEBUI_HOST=0.0.0.0
export HERMES_WEBUI_PORT=8787
export HERMES_WEBUI_PASSWORD="${WEBUI_PASSWORD}"

until curl -sf http://localhost:8642/health > /dev/null 2>&1; do
  sleep 1
done

cd /opt/hermes-webui && exec python3 server.py
