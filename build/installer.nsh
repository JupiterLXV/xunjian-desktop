; 当前用户安装；卸载保留本应用数据，覆盖升级保留数据。
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "安装图像标注软件"
  !define MUI_WELCOMEPAGE_TEXT "将为当前 Windows 用户安装程序，并创建桌面和开始菜单快捷方式。$\r$\n$\r$\n请先关闭正在运行的旧版程序。安装后，已有设置和使用记录继续保留；启动后使用后端账号密码登录。$\r$\n$\r$\n点击“下一步”选择安装位置。"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_UNWELCOMEPAGE_TITLE "卸载图像标注软件"
  !define MUI_UNWELCOMEPAGE_TEXT "将卸载程序和快捷方式。$\r$\n$\r$\n卸载保留本应用的设置、目录记忆、草稿及本地记录。程序目录之外的巡检原图、输出成果和成果回收站不会删除。过期登录需要重新联网认证。"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; 对实际创建的桌面快捷方式显式设置独立 ICO，覆盖旧链接的图标引用。
!macro customInstall
  ${if} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endif}
!macroend
