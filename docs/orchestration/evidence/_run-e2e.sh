#!/bin/bash
# run a given e2e script (arg1) with playwright env + fontconfig
source /workspace/ssd/toolchain/scripts/playwright-env.sh
export FONTCONFIG_FILE=/workspace/ssd/toolchain/chromium-env/fonts.conf
cd /workspace/ssd/qlttxd/docs/orchestration/evidence
exec node "$1"
