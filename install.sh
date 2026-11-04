#!/bin/sh
# Install or update this layout, mods and keys into the Herdr app home (macOS/Linux).
# Safe to re-run: backs up your keys.json once, then copies over.
set -eu
repo="$(cd "$(dirname "$0")" && pwd)"
cfg="${HERDR_APP_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/herdr-app}"

mkdir -p "$cfg/layouts" "$cfg/mods"
if [ -e "$cfg/keys.json" ] && [ ! -e "$cfg/keys.json.before-fleet" ]; then
  cp "$cfg/keys.json" "$cfg/keys.json.before-fleet"
fi
cp "$repo/keys.json" "$cfg/keys.json"
cp "$repo/layouts/"my-fleet.* "$cfg/layouts/"
for m in fleet fleet-shell-bar; do
  rm -rf "$cfg/mods/$m"
  cp -R "$repo/mods/$m" "$cfg/mods/$m"
done
echo "copied to $cfg"

if command -v herdr-app >/dev/null 2>&1; then
  herdr-app check "$cfg/mods/fleet"
  herdr-app check "$cfg/mods/fleet-shell-bar"
  herdr-app do layout.switch '{"name":"my-fleet"}' || echo "open the Herdr app, then press ctrl-shift-l to pick my-fleet"
else
  echo "herdr-app CLI not on PATH: open the app and pick my-fleet with ctrl-shift-l"
fi
