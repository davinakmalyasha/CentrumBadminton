# start-all.ps1 — supervised startup for CentrumBadminton (:3000) + AgentsProxy (:8080)
# Replaces blind kill-all + hidden windows. Run: powershell -ExecutionPolicy Bypass -File .\start-all.ps1
$ErrorActionPreference = "Continue"
$centrum = "D:\MyProject\CentrumBadminton"
$proxyDir = "D:\MyProject\AgentsProxy"

function Stop-NextDev {
  # Target ONLY next-dev processes (launcher + turbopack workers), never blind kill-all.
  $victims = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*next*dist*bin*next*dev*" -or $_.CommandLine -like "*turbopack*"
  }
  foreach ($v in $victims) {
    Write-Host "Stopping stale next-dev PID $($v.ProcessId) ..."
    Stop-Process -Id $v.ProcessId -Force -ErrorAction SilentlyContinue
  }
  if ($victims) { Start-Sleep -Seconds 3 }
}

function Stop-Proxy {
  $srv = Get-Process -Name "server" -ErrorAction SilentlyContinue
  foreach ($p in $srv) {
    Write-Host "Stopping stale proxy PID $($p.Id) ..."
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
  if ($srv) { Start-Sleep -Seconds 3 }
}

function Wait-Healthy($url, $label, $seconds = 90) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
      if ($r.StatusCode -eq 200) { Write-Host "$label OK ($url)" ; return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  Write-Host "$label FAILED to become healthy: $url"
  return $false
}

Write-Host "=== 1/4 stopping stale next-dev + proxy (targeted, no kill-all) ==="
Stop-NextDev
Stop-Proxy

Write-Host "=== 2/4 starting proxy (:8080, visible window, logs to proxy.log) ==="
Start-Process powershell -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-File","D:\MyProject\AgentsProxy\start-proxy.ps1" -WorkingDirectory $proxyDir
$proxyOk = Wait-Healthy "http://localhost:8080/healthz" "proxy" 90

Write-Host "=== 3/4 starting next dev (:3000, visible window) ==="
Start-Process powershell -ArgumentList "-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command","npm run dev" -WorkingDirectory $centrum
$webOk = Wait-Healthy "http://localhost:3000/" "landing" 120

Write-Host "=== 4/4 summary ==="
if ($proxyOk) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/availability?date=$((Get-Date).ToString('yyyy-MM-dd'))" -UseBasicParsing -TimeoutSec 8
    $j = $r.Content | ConvertFrom-Json
    Write-Host "availability via Next: $($r.StatusCode), facilities: $($j.facilities.Count)"
  } catch { Write-Host "availability via Next: FAILED $($_.Exception.Message)" }
} else {
  Write-Host "proxy is DOWN — check the proxy window + D:\MyProject\AgentsProxy\proxy.log"
}
if (-not $webOk) { Write-Host "web is DOWN — check the next-dev window." }
Write-Host "Done. Keep BOTH windows open. Run .\status.ps1 anytime for a health snapshot."
