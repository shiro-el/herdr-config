# Herdr personal fleet

기본 Agents 모양으로 모든 머신의 space와 에이전트 부모·자식 트리를 표시합니다. 왼쪽은 너비 조절 목록, 가운데는 선택한 에이전트입니다. 완료된 자식은 부모의 화살표·숫자로 펼칩니다. space 이름을 선택하면 그 저장소, 에이전트를 선택하면 그 현재 폴더에서 셸을 엽니다. 셸은 별도 창이며 창을 닫아도 실행되고 목록에서 다시 열 수 있습니다.

| 키 (macOS·Windows 공통) | 동작 |
| --- | --- |
| Ctrl+Shift+J / K | 펼쳐진 트리의 다음 / 이전 live 터미널 (`fleet.next/prev`, 끝에서 순환) |
| Ctrl+Shift+Enter | 선택한 항목의 머신·폴더에 새 셸 창 |
| Ctrl+Shift+Space | 열려 있는 셸 창 전체 숨기기 / 복원 |
| Ctrl+Shift+B | 목록 표시 / 숨기기 |

`keys.json`은 기본 공통 키를 유지하고 위 키만 바꿉니다. 기본 Ctrl+Shift+K(space picker)는 이전 에이전트로 바뀝니다. macOS용 기본 파일의 Cmd 단축키·Option 편집키·Ctrl+숫자 space 선택은 합치지 않아, 두 OS에서 같은 Ctrl 체계를 사용합니다.

macOS·Windows **각 클라이언트**에 Herdr 앱과 Git을 설치하고 앱을 한 번 실행한 뒤 종료하세요. 설정 경로는 macOS `~/.config/herdr-app`, Windows `$HOME\.config\herdr-app`입니다(AppData 아님). `HERDR_APP_HOME` 또는 `XDG_CONFIG_HOME`을 설정했다면 그 경로를 쓰세요. 앱의 Machines 설정에서 이 워크스테이션 SSH 연결도 추가합니다.

macOS 터미널:

```sh
git clone https://github.com/shiro-el/herdr-config.git "$HOME/herdr-config"
repo="$HOME/herdr-config"
cfg="$HOME/.config/herdr-app"
mkdir -p "$cfg/layouts" "$cfg/mods"
[ ! -e "$cfg/keys.json" ] || cp "$cfg/keys.json" "$cfg/keys.json.before-fleet"
cp "$repo/keys.json" "$cfg/keys.json"
cp "$repo/layouts/"my-fleet.* "$cfg/layouts/"
cp -R "$repo/mods/fleet" "$repo/mods/fleet-shell-bar" "$cfg/mods/"
```

Windows PowerShell:

```powershell
git clone https://github.com/shiro-el/herdr-config.git "$HOME\herdr-config"
$repo = "$HOME\herdr-config"
$cfg = "$HOME\.config\herdr-app"
New-Item -ItemType Directory -Force "$cfg\layouts", "$cfg\mods" | Out-Null
if (Test-Path "$cfg\keys.json") { Copy-Item "$cfg\keys.json" "$cfg\keys.json.before-fleet" }
Copy-Item "$repo\keys.json" "$cfg\keys.json"
Copy-Item "$repo\layouts\my-fleet.*" "$cfg\layouts\"
Copy-Item -Recurse -Force "$repo\mods\fleet", "$repo\mods\fleet-shell-bar" "$cfg\mods\"
```

앱을 다시 실행한 뒤 macOS에서 다음을 실행합니다. Windows도 PowerShell에서 같은 `do` 명령을 사용합니다.

```sh
herdr-app check ~/.config/herdr-app/mods/fleet
herdr-app check ~/.config/herdr-app/mods/fleet-shell-bar
herdr-app do layout.switch '{"name":"my-fleet"}'
```

Windows 검사 경로는 `"$cfg\mods\fleet"`, `"$cfg\mods\fleet-shell-bar"`로 바꾸세요. PowerShell에서 JSON 인수 전달이 안 되면 `herdr-app do layout.switch --name my-fleet`도 같습니다. 업데이트는 clone 폴더에서 `git pull --ff-only` 후 위 복사·검사를 반복합니다(백업 줄은 첫 설치 때만 실행). 개인 설정과 앱 상태 파일은 복사하지 않습니다.

이 Linux 호스트에는 앱이 없어 네이티브 검사·화면 검증은 하지 못했습니다. 종료된 자식은 core 이력을 30초마다 읽습니다. `fleet.next/prev`가 현재 표시된 에이전트(없으면 선택 행)에서 같은 깊이 우선 순서로 이동하고, 접힌 행·종료된 터미널·셸 창은 건너뜁니다. 이동하면 가운데 표시와 트리 선택도 함께 바뀝니다. 내장 순회용 `setAgentOrder`도 계속 전달합니다. 직접 클릭은 살아 있는 자식을 가운데에 표시하고, 종료된 항목은 폴더 선택용으로 남습니다. 두 클라이언트에서 키 4개, 자식 클릭·접기, 원격 셸의 경로, 창 닫기·복원·앱 재시작을 확인하세요.
