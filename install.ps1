# Install or update this layout, mods and keys into the Herdr app home (Windows).
# Safe to re-run: updates the fleet mods only. An existing keys.json and my-fleet layout are
# left alone, and the app switches to my-fleet only on the first install.
$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot
$cfg = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME }
       elseif ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME "herdr-app" }
       else { Join-Path $HOME ".config\herdr-app" }

$first = -not (Test-Path (Join-Path $cfg "layouts\my-fleet.json"))

New-Item -ItemType Directory -Force (Join-Path $cfg "layouts"), (Join-Path $cfg "mods") | Out-Null
$keys = Join-Path $cfg "keys.json"
if (Test-Path $keys) {
  Write-Host "kept your keys.json (fleet keys are in $repo\keys.json if you want to merge them)"
} else {
  Copy-Item (Join-Path $repo "keys.json") $keys
}
if ($first) {
  Copy-Item (Join-Path $repo "layouts\my-fleet.*") (Join-Path $cfg "layouts") -Force
} else {
  Write-Host "kept your layouts\my-fleet.json"
}
foreach ($m in "fleet", "fleet-shell-bar") {
  $dst = Join-Path $cfg "mods\$m"
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse (Join-Path $repo "mods\$m") $dst
}
Write-Host "copied to $cfg"

if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
  herdr-app check (Join-Path $cfg "mods\fleet")
  herdr-app check (Join-Path $cfg "mods\fleet-shell-bar")
  if ($first) {
    herdr-app do layout.switch --name my-fleet
    if ($LASTEXITCODE -ne 0) { Write-Host "open the Herdr app, then press ctrl-shift-l to pick my-fleet" }
  }
} elseif ($first) {
  Write-Host "herdr-app CLI not on PATH: open the app and pick my-fleet with ctrl-shift-l"
}
