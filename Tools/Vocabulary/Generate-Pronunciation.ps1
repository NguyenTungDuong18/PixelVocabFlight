param([string]$ProjectRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)), [switch]$Prototype)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$catalogName = if ($Prototype) { 'prototype-vocabulary.json' } else { 'oxford-vocabulary.json' }
$catalogPath = Join-Path $ProjectRoot ('Game\Assets\_Project\Data\Vocabulary\Resources\' + $catalogName)
$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$outputFolder = Join-Path $ProjectRoot 'Game\Assets\_Project\Audio\Pronunciation\US\Resources\Pronunciation'
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SelectVoice('Microsoft David Desktop')
    $synth.Rate = -1
    $synth.Volume = 90
    $completed = 0
    $generated = 0
    $entries = @($catalog.entries | Group-Object { if ($_.audioKey) { $_.audioKey } else { $_.word } } | ForEach-Object { $_.Group[0] })
    foreach ($entry in $entries) {
        $key = if ($entry.audioKey) { $entry.audioKey } else { $entry.word }
        # Same rule as Scripts/Logic/Vocabulary/PronunciationPath.cs: sub-folder = first letter of the word, '_' if not a-z.
        $letter = if ($entry.word) { $entry.word.Substring(0, 1).ToLowerInvariant() } else { '_' }
        if ($letter -notmatch '^[a-z]$') { $letter = '_' }
        New-Item -ItemType Directory -Path (Join-Path $outputFolder $letter) -Force | Out-Null
        $outputPath = Join-Path (Join-Path $outputFolder $letter) ($key + '.wav')
        $completed++
        if ((Test-Path -LiteralPath $outputPath) -and (Get-Item -LiteralPath $outputPath).Length -gt 1000) { continue }
        $synth.SetOutputToWaveFile($outputPath)
        $synth.Speak($entry.word)
        $synth.SetOutputToNull()
        $generated++
        if ($completed % 500 -eq 0) { Write-Output ('Pronunciation: ' + $completed + '/' + $entries.Count) }
    }
    Write-Output ('Pronunciation ready: ' + $entries.Count + ' distinct words; generated ' + $generated + ' new clips.')
} finally { $synth.Dispose() }
