#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv 2>/dev/null || true
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r server/requirements.txt
exec uvicorn server.app.main:app --host 127.0.0.1 --port 8787 --reload
