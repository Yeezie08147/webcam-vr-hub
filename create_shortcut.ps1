$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path -Path $DesktopPath -ChildPath "Webcam VR Game Hub.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

$ProjectDir = "c:\workspace\webcam-vr-hub"
$VbsPath = Join-Path -Path $ProjectDir -ChildPath "launch_silent.vbs"
$IconPath = Join-Path -Path $ProjectDir -ChildPath "assets\vr_icon.ico"

$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.IconLocation = "$IconPath, 0"
$Shortcut.Description = "Webcam VR Game Hub - Motion VR games using only your webcam"
$Shortcut.Save()

Write-Host "Created Desktop Shortcut at: $ShortcutPath"
