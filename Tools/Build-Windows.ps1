param([string]$EditorPath = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceGame = Join-Path $projectRoot 'Game'
function Get-SourceHash([string]$FilePath) {
    if (Test-Path -LiteralPath $FilePath) { return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash }
    return ''
}
$settingsNames = @('EditorBuildSettings.asset', 'EditorSettings.asset', 'ProjectSettings.asset')
$beforeHashes = @{}
foreach ($name in $settingsNames) { $beforeHashes[$name] = Get-SourceHash (Join-Path $sourceGame ('ProjectSettings\' + $name)) }
$sourceScene = Join-Path $sourceGame 'Assets\_Project\Scenes\Flight.unity'
$sceneHashBefore = Get-SourceHash $sourceScene
$workingGame = Join-Path $PSScriptRoot 'BuildWorkspace\Game'
New-Item -ItemType Directory -Path $workingGame -Force | Out-Null
foreach ($folder in @('Assets', 'Packages', 'ProjectSettings')) {
    Copy-Item -LiteralPath (Join-Path $sourceGame $folder) -Destination $workingGame -Recurse -Force
}
$outputExe = Join-Path $projectRoot 'Builds\Windows\Wordwing.exe'
$buildLog = Join-Path $PSScriptRoot 'unity-build-isolated.log'
# Quote each path because this script must also work if the project is moved into a folder containing spaces.
$editorArgs = @('-batchmode', '-nographics', '-quit', '-projectPath', ('"' + $workingGame + '"'), '-executeMethod', 'PixelVocabFlight.Editor.PrototypeBuild.BuildWindows', '-wordwingBuildOutput', ('"' + $outputExe + '"'), '-logFile', ('"' + $buildLog + '"'))
$process = Start-Process -FilePath $EditorPath -ArgumentList $editorArgs -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw ('Unity build failed, code ' + $process.ExitCode + '. See ' + $buildLog) }

# Keep GUIDs generated during import, without replacing metadata already present in the source project.
$workingAssets = Join-Path $workingGame 'Assets'
$sourceAssets = Join-Path $sourceGame 'Assets'
Get-ChildItem -LiteralPath $workingAssets -Filter '*.meta' -File -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($workingAssets.Length + 1)
    $target = Join-Path $sourceAssets $relative
    if (-not (Test-Path -LiteralPath $target)) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
}
if ((Get-SourceHash $sourceScene) -eq $sceneHashBefore) {
    Copy-Item -LiteralPath (Join-Path $workingGame 'Assets\_Project\Scenes\Flight.unity') -Destination $sourceScene -Force
}
foreach ($settings in $settingsNames) {
    $settingsPath = Join-Path $sourceGame ('ProjectSettings\' + $settings)
    if ((Get-SourceHash $settingsPath) -eq $beforeHashes[$settings]) {
        Copy-Item -LiteralPath (Join-Path $workingGame ('ProjectSettings\' + $settings)) -Destination $settingsPath -Force
    } else { Write-Output ('Kept concurrent source change: ' + $settings) }
}
Write-Output ('BUILD SUCCESS: ' + $outputExe)
