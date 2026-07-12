$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force (Join-Path $repo 'logs') | Out-Null

$action = New-ScheduledTaskAction -Execute 'wscript.exe' `
  -Argument ('"{0}"' -f (Join-Path $repo 'scripts\start-server.vbs'))
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerWatch = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'WahnahbeSystem' -Action $action -Trigger $triggerLogon, $triggerWatch `
  -Settings $settings -Description 'Wahnahbe System dashboard server (localhost:4777)' -Force
Write-Host 'Installed. Starting now…'
Start-ScheduledTask -TaskName 'WahnahbeSystem'
