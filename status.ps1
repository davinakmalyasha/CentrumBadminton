# status.ps1 — health snapshot for CentrumBadminton (:3000) + AgentsProxy (:8080)
# Run from anywhere: powershell -ExecutionPolicy Bypass -File .\status.ps1
# Set AGENTSPROXY_DIR if the proxy is not a sibling of this repository.
$ErrorActionPreference = "Continue"

$centrum = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$parent = Split-Path $centrum -Parent
$proxyDir = if ($env:AGENTSPROXY_DIR) {
  (Resolve-Path $env:AGENTSPROXY_DIR).Path
} else {
  Join-Path $parent "AgentsProxy"
}
$proxyLog = Join-Path $proxyDir "proxy.log"

function Show-Port($port) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    Write-Host ":$port LISTEN pid=$($c.OwningProcess) proc=$($p.ProcessName)"
  } else {
    Write-Host ":$port NOT LISTENING"
  }
}

Write-Host "--- ports ---"
Show-Port 3000
Show-Port 8080

Write-Host "--- next-dev processes (should be ONE tree) ---"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
  $_.CommandLine -like "*next*dist*bin*next*dev*" -or $_.CommandLine -like "*turbopack*"
} | Select-Object ProcessId, CreationDate | Format-Table -AutoSize

Write-Host "--- proxy process ---"
$proxyConn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proxyConn) {
  Get-Process -Id $proxyConn.OwningProcess -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize
} else {
  Write-Host "proxy: not listening"
}

Write-Host "--- endpoints ---"
try { $r = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -UseBasicParsing -TimeoutSec 5; Write-Host "proxy /healthz: $($r.StatusCode)" } catch { Write-Host "proxy /healthz: DOWN" }
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 8
  $j = $r.Content | ConvertFrom-Json
  Write-Host "next /api/health: $($r.StatusCode), status=$($j.status), proxy=$($j.proxyStatus)"
} catch { Write-Host "next /api/health: DOWN/ERR" }
try { $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 8; Write-Host "landing /: $($r.StatusCode), badge=$($r.Content.Contains('centrumLOGO-badge'))" } catch { Write-Host "landing /: DOWN" }

Write-Host "--- proxy config in use (from proxy.log) ---"
Get-Content $proxyLog -ErrorAction SilentlyContinue | Select-String "config loaded" | Select-Object -Last 1 | ForEach-Object {
  $s = $_.ToString()
  if ($s -match "llm_base=([^ ]+)") { Write-Host "llm_base: $($Matches[1])" }
  if ($s -match "llm_model=([^ ]+)") { Write-Host "llm_model: $($Matches[1])" }
  if ($s -match "rate_limit=(\d+)") { Write-Host "rate_limit: $($Matches[1])" }
}
