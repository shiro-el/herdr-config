#!/bin/sh
# Install or update this layout, mods and keys into the Herdr app home (macOS/Linux).
# Safe to re-run: updates the fleet mods only. An existing keys.json and my-fleet layout are
# left alone, and the app switches to my-fleet only on the first install.
set -eu
repo="$(cd "$(dirname "$0")" && pwd)"
cfg="${HERDR_APP_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/herdr-app}"

first=false
[ -e "$cfg/layouts/my-fleet.json" ] || first=true

mkdir -p "$cfg/layouts" "$cfg/mods"
if [ -e "$cfg/keys.json" ]; then
  echo "kept your keys.json (fleet keys are in $repo/keys.json if you want to merge them)"
else
  cp "$repo/keys.json" "$cfg/keys.json"
fi
if [ "$first" = true ]; then
  cp "$repo/layouts/"my-fleet.* "$cfg/layouts/"
else
  echo "kept your layouts/my-fleet.json"
fi
for m in fleet fleet-shell-bar; do
  rm -rf "$cfg/mods/$m"
  cp -R "$repo/mods/$m" "$cfg/mods/$m"
done
echo "copied to $cfg"

if command -v herdr-app >/dev/null 2>&1; then
  herdr-app check "$cfg/mods/fleet"
  herdr-app check "$cfg/mods/fleet-shell-bar"
  if [ "$first" = true ]; then
    herdr-app do layout.switch '{"name":"my-fleet"}' || echo "open the Herdr app, then press ctrl-shift-l to pick my-fleet"
  fi
elif [ "$first" = true ]; then
  echo "herdr-app CLI not on PATH: open the app and pick my-fleet with ctrl-shift-l"
fi
