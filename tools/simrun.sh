#!/bin/bash
# simrun.sh <prg> <out.png> [seconds=14]
# Runs a .prg in a fresh headless Connect IQ simulator (fr970), captures the
# app console output (println, crashes) and saves a 454x454 screenshot of the
# display at the end. Needs the local simulator setup in /opt/ciq (see
# tools/README-dev.md).
# Up to SIM_SLOTS simulators run in parallel, each on its own Xvfb display and
# in its own network namespace (the simulator listens on a fixed TCP port).
set -u
SDK=/opt/ciq/sdk
LIBS=/opt/ciq/jammy-libs/usr/lib/x86_64-linux-gnu
DEV=fr970

if [ "${1:-}" = "--inner" ]; then
  # runs inside the private network namespace
  shift
  PRG=$1; OUT=$2; SECS=$3; LOG=$4
  ip link set lo up 2>/dev/null
  (cd /opt/ciq/sim && LD_LIBRARY_PATH=$LIBS exec "$SDK/bin/simulator" </dev/null >/dev/null 2>&1) &
  SIMPID=$!
  for i in $(seq 1 80); do
    xwininfo -root -tree 2>/dev/null | grep -q '("simulator" "Simulator")' && break
    sleep 0.5
  done
  sleep 5
  MD=""
  for attempt in 1 2 3 4 5 6 7 8; do
    : > "$LOG"
    (timeout "$SECS" script -qfc "$SDK/bin/monkeydo $PRG $DEV" "$LOG" </dev/null >/dev/null 2>&1) &
    MD=$!
    sleep 4
    grep -q "Unable to connect" "$LOG" || break
    wait $MD 2>/dev/null; sleep 1
  done
  sleep $((SECS - 5))
  timeout 20 import -window root "$OUT.root.png"
  python3 - "$OUT" <<'PY'
import sys
from PIL import Image
out = sys.argv[1]
im = Image.open(out + '.root.png').convert('RGB')
im.crop((155, 216, 155 + 454, 216 + 454)).save(out)
PY
  rm -f "$OUT.root.png"
  sleep 1.5
  [ -n "$MD" ] && { pkill -P $MD 2>/dev/null; kill $MD 2>/dev/null; }
  kill $SIMPID 2>/dev/null; sleep 0.5; kill -9 $SIMPID 2>/dev/null
  exit 0
fi

PRG=$(readlink -f "${1:?prg}")
OUT=$(readlink -m "${2:?out.png}")
SECS=${3:-24}
SLOTS=${SIM_SLOTS:-3}

# grab a free slot (or wait for one)
SLOT=""
for n in $(seq 1 "$SLOTS"); do
  exec 9>/tmp/facelab-sim.$n.lock
  if flock -n 9; then SLOT=$n; break; fi
  exec 9>&-
done
if [ -z "$SLOT" ]; then
  SLOT=$(( (RANDOM % SLOTS) + 1 ))
  exec 9>/tmp/facelab-sim.$SLOT.lock
  flock -w 1800 9 || { echo "simulator busy"; exit 5; }
fi

export DISPLAY=":$((90 + SLOT))"
if ! xdpyinfo >/dev/null 2>&1; then
  (setsid Xvfb "$DISPLAY" -screen 0 1600x1200x24 -nolisten tcp </dev/null >/dev/null 2>&1 9>&- &)
  for i in $(seq 1 50); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.2; done
fi
LOG=$(mktemp)
# the simulator is single-instance per $HOME: give every slot its own home
SH=/tmp/facelab-simhome.$SLOT
mkdir -p "$SH" && ln -sfn "$HOME/.Garmin" "$SH/.Garmin"
HOME=$SH timeout $((SECS + 120)) unshare -n bash "$0" --inner "$PRG" "$OUT" "$SECS" "$LOG" 9>&-
echo "--- app output (sim slot $SLOT) ---"
grep -av "JAVA_TOOL\|^Script \|^$" "$LOG" | tail -n ${SIM_TAIL:-25}
echo "--- screenshot: $OUT"
rm -f "$LOG"
