#!/bin/bash
# start FE dev server on 5199, proxy to BE 4100
export PATH=/workspace/ssd/toolchain/node/bin:$PATH
cd /workspace/ssd/qlttxd/app/frontend
export VITE_PROXY_TARGET=http://127.0.0.1:4100
exec npm run dev -- --port 5199 --strictPort
