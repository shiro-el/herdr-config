# Herdr personal fleet

기본 Agents 모양으로 모든 머신의 space와 에이전트 부모·자식 트리를 표시합니다. 왼쪽은 너비 조절 목록, 가운데는 선택한 에이전트입니다. 완료된 자식은 부모의 화살표·숫자로 펼칩니다. space 이름을 선택하면 그 저장소, 에이전트를 선택하면 그 현재 폴더에서 셸을 엽니다. 셸은 별도 창이며 창을 닫아도 실행되고 목록에서 다시 열 수 있습니다.

| 키 (macOS·Windows 공통) | 동작 |
| --- | --- |
| Ctrl+Shift+J / K | 펼쳐진 트리의 다음 / 이전 live 터미널 (`fleet.next/prev`, 끝에서 순환) |
| Ctrl+Shift+Enter | 선택한 항목의 머신·폴더에 새 셸 창 |
| Ctrl+Shift+Space | 열려 있는 셸 창 전체 숨기기 / 복원 |
| Ctrl+Shift+B | 목록 표시 / 숨기기 |

`keys.json`은 기본 공통 키를 유지하고 위 키만 바꿉니다. 기본 Ctrl+Shift+K(space picker)는 이전 에이전트로 바뀝니다. macOS용 기본 파일의 Cmd 단축키·Option 편집키·Ctrl+숫자 space 선택은 합치지 않아, 두 OS에서 같은 Ctrl 체계를 사용합니다.

macOS·Windows·Linux **각 클라이언트**에 Herdr 앱과 Git을 설치하세요. 설정 경로는 macOS·Linux `~/.config/herdr-app`, Windows `$HOME\.config\herdr-app`입니다(AppData 아님). `HERDR_APP_HOME` 또는 `XDG_CONFIG_HOME`을 설정했다면 그 경로를 쓰세요. 앱의 Machines 설정에서 이 워크스테이션 SSH 연결도 추가합니다.

설치와 업데이트는 같은 한 줄입니다. 처음이면 clone하고, 이미 있으면 pull한 뒤 복사·검사·레이아웃 전환까지 합니다. 기존 `keys.json`은 처음 한 번만 `keys.json.before-fleet`으로 백업합니다. private repo라 클라이언트에 GitHub 인증(`gh auth login` 등)이 되어 있어야 합니다.

macOS·Linux 터미널:

```sh
git clone https://github.com/shiro-el/herdr-config.git ~/herdr-config 2>/dev/null; git -C ~/herdr-config pull --ff-only && sh ~/herdr-config/install.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/shiro-el/herdr-config.git $HOME\herdr-config 2>$null; git -C $HOME\herdr-config pull --ff-only; powershell -ExecutionPolicy Bypass -File $HOME\herdr-config\install.ps1
```

앱이 켜져 있으면 바로 `my-fleet`으로 바뀝니다. `herdr-app` CLI가 PATH에 없거나 앱이 꺼져 있으면 복사만 하므로, 앱에서 `ctrl-shift-l`로 `my-fleet`을 고르세요. 되돌리려면 `keys.json.before-fleet`을 `keys.json`으로 되돌리고 `ctrl-shift-l`로 기본 레이아웃을 고릅니다. 개인 설정과 앱 상태 파일은 복사하지 않습니다.

이 Linux 호스트에는 앱이 없어 네이티브 검사·화면 검증은 하지 못했습니다. 종료된 자식은 core 이력을 30초마다 읽습니다. `fleet.next/prev`가 현재 표시된 에이전트(없으면 선택 행)에서 같은 깊이 우선 순서로 이동하고, 접힌 행·종료된 터미널·셸 창은 건너뜁니다. 이동하면 가운데 표시와 트리 선택도 함께 바뀝니다. 내장 순회용 `setAgentOrder`도 계속 전달합니다. 직접 클릭은 살아 있는 자식을 가운데에 표시하고, 종료된 항목은 폴더 선택용으로 남습니다. 두 클라이언트에서 키 4개, 자식 클릭·접기, 원격 셸의 경로, 창 닫기·복원·앱 재시작을 확인하세요.
