# Install or update this layout, mods and keys into the Herdr app home (Windows).
# Safe to re-run: backs up your keys.json once, then copies over.
$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot
$cfg = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME }
       elseif ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME "herdr-app" }
       else { Join-Path $HOME ".config\herdr-app" }

New-Item -ItemType Directory -Force (Join-Path $cfg "layouts"), (Join-Path $cfg "mods") | Out-Null
$keys = Join-Path $cfg "keys.json"
if ((Test-Path $keys) -and -not (Test-Path "$keys.before-fleet")) { Copy-Item $keys "$keys.before-fleet" }
Copy-Item (Join-Path $repo "keys.json") $keys -Force
Copy-Item (Join-Path $repo "layouts\my-fleet.*") (Join-Path $cfg "layouts") -Force
foreach ($m in "fleet", "fleet-shell-bar") {
  $dst = Join-Path $cfg "mods\$m"
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse (Join-Path $repo "mods\$m") $dst
}
Write-Host "copied to $cfg"

if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
  herdr-app check (Join-Path $cfg "mods\fleet")
  herdr-app check (Join-Path $cfg "mods\fleet-shell-bar")
  herdr-app do layout.switch --name my-fleet
  if ($LASTEXITCODE -ne 0) { Write-Host "open the Herdr app, then press ctrl-shift-l to pick my-fleet" }
} else {
  Write-Host "herdr-app CLI not on PATH: open the app and pick my-fleet with ctrl-shift-l"
}
