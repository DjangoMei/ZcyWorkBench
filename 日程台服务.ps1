param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$NodeExe = if ($NodeCommand) {
  $NodeCommand.Source
} else {
  Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}
$VinextCli = Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"
$LogRoot = Join-Path $ProjectRoot ".logs"
$WebUrl = "http://localhost:777/zcyworkbench/"
$WebHealthUrl = "http://127.0.0.1:777/zcyworkbench/"
$DataUrl = "http://127.0.0.1:4174/api/data"

New-Item -ItemType Directory -Path $LogRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $NodeExe)) {
  throw "Node.js was not found. Install Node.js 22 or later before starting."
}

function Test-LocalUrl {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-LocalUrl -Url $DataUrl)) {
  Start-Process `
    -FilePath $NodeExe `
    -ArgumentList "local-data-server.mjs" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogRoot "data-service.log") `
    -RedirectStandardError (Join-Path $LogRoot "data-service-error.log")
}

if (-not (Test-LocalUrl -Url $WebHealthUrl)) {
  Start-Process `
    -FilePath $NodeExe `
    -ArgumentList @(
      $VinextCli,
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "777"
    ) `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogRoot "web-service.log") `
    -RedirectStandardError (Join-Path $LogRoot "web-service-error.log")
}

$deadline = (Get-Date).AddSeconds(25)
do {
  Start-Sleep -Milliseconds 350
  $webReady = Test-LocalUrl -Url $WebHealthUrl
  $dataReady = Test-LocalUrl -Url $DataUrl
} until (($webReady -and $dataReady) -or (Get-Date) -ge $deadline)

if (-not ($webReady -and $dataReady)) {
  throw "The local daybook services did not start correctly."
}

if ($OpenBrowser) {
  Start-Process $WebUrl
}
