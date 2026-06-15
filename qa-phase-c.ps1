$base = "http://localhost:3001"

Write-Host "====== PHASE C + CLI + STORIES EVIDENCE ======"

# --- A-06: CLI check ---
Write-Host "`n--- A-06: CLI package build status ---"
$cliPkg = Get-Content "C:\Users\Hp\Documents\opendesign-qa\packages\cli\package.json" -Raw | ConvertFrom-Json
Write-Host "  name: $($cliPkg.name)"
Write-Host "  bin: odqa -> $($cliPkg.bin.odqa)"
$distExists = Test-Path "C:\Users\Hp\Documents\opendesign-qa\packages\cli\dist\index.js"
Write-Host "  dist/index.js exists: $distExists"
if (-not $distExists) {
    Write-Host "  CLI not built - checking source..."
    $srcExists = Test-Path "C:\Users\Hp\Documents\opendesign-qa\packages\cli\src"
    Write-Host "  src/ exists: $srcExists"
    if ($srcExists) {
        $srcFiles = Get-ChildItem "C:\Users\Hp\Documents\opendesign-qa\packages\cli\src" -Recurse -Filter "*.ts"
        Write-Host "  src files: $($srcFiles.Count)"
        $srcFiles | ForEach-Object { Write-Host "    $($_.Name)" }
    }
}

# --- C-01: Design token upload endpoint ---
Write-Host "`n--- C-01: Design token upload endpoint ---"
try {
    $tokResp = Invoke-WebRequest "$base/api/projects/test/tokens" -Method GET -UseBasicParsing
    Write-Host "GET tokens: $($tokResp.StatusCode)"
} catch {
    Write-Host "GET tokens FAILED: HTTP $($_.Exception.Response.StatusCode)"
}

# --- C-02: Core Web Vitals / performanceMetrics ---
Write-Host "`n--- C-02: CWV - check if performanceMetrics field on viewport run ---"
$runResp = (Invoke-WebRequest "$base/api/runs/79e86215-27d4-4dc2-bded-dbf80d28f8cf" -UseBasicParsing).Content | ConvertFrom-Json
$hasCWV = $runResp.viewportRuns[0].PSObject.Properties.Name -contains "performanceMetrics"
Write-Host "  performanceMetrics field on viewportRun: $hasCWV"

# --- C-03: Animation capture option ---
Write-Host "`n--- C-03: Animation capture - captureAnimation field in POST /api/runs ---"
$projC = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"animation-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$runCBody = @{ projectId=$projC.id; url="http://localhost:3000"; viewports=@("desktop"); captureAnimation=$true } | ConvertTo-Json
try {
    $runCResp = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $runCBody -UseBasicParsing
    $runCData = $runCResp.Content | ConvertFrom-Json
    Write-Host "  captureAnimation accepted: $($runCResp.StatusCode)"
    Write-Host "  captureAnimation in response: $($runCData.captureAnimation)"
} catch {
    Write-Host "  captureAnimation FAILED: $($_.Exception.Message)"
}

# --- C-04: Plugin SDK / custom rule endpoint ---
Write-Host "`n--- C-04: Plugin/custom rule registration endpoint ---"
try {
    $pluginResp = Invoke-WebRequest "$base/api/rules" -Method GET -UseBasicParsing
    Write-Host "GET /api/rules: $($pluginResp.StatusCode)"
    Write-Host "  $($pluginResp.Content)"
} catch {
    Write-Host "GET /api/rules FAILED: HTTP $($_.Exception.Response.StatusCode)"
}

# --- C-05: Billing endpoint ---
Write-Host "`n--- C-05: Billing endpoint ---"
try {
    $billingResp = Invoke-WebRequest "$base/api/billing" -Method GET -UseBasicParsing
    Write-Host "GET /api/billing: $($billingResp.StatusCode)"
} catch {
    Write-Host "GET /api/billing FAILED: HTTP $($_.Exception.Response.StatusCode)"
}

# --- All available API routes (for completeness) ---
Write-Host "`n--- API health check ---"
$healthResp = (Invoke-WebRequest "$base/health" -UseBasicParsing).Content
Write-Host "  health: $healthResp"

Write-Host "`n====== PHASE C + STORIES DONE ======"
