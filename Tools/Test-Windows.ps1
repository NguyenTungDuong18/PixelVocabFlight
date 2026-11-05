param(
    [string]$OutputFolder = 'Latest',
    [int]$Width = 1280,
    [int]$Height = 800
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qaDirectory = Join-Path (Join-Path $PSScriptRoot 'Smoke') $OutputFolder
New-Item -ItemType Directory -Path $qaDirectory -Force | Out-Null
$log = Join-Path $qaDirectory 'player.log'
$exe = Join-Path $projectRoot 'Builds\Windows\Wordwing.exe'
$qaArguments = @('--smoke-test','--smoke-output',('"'+$qaDirectory+'"'),'-logFile',('"'+$log+'"'),'-screen-width',$Width,'-screen-height',$Height,'-screen-fullscreen','0')
$process = Start-Process -FilePath $exe -ArgumentList $qaArguments -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw ('Runtime checks failed: exit '+$process.ExitCode+'. See '+$log) }
$report = Get-Content -LiteralPath (Join-Path $qaDirectory 'smoke-report.json') -Raw | ConvertFrom-Json
$failures = @($report.checks | Where-Object { $_ -notlike '*:PASS' })
if ($failures.Count -gt 0) { throw ($failures -join "`n") }
Write-Output ('PASS: '+$report.checks.Count+' runtime checks, version '+$report.version+', '+$Width+'x'+$Height)
Write-Output ('Screenshots and report: '+$qaDirectory)
