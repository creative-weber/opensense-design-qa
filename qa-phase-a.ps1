$base = "http://localhost:3001"
$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "====== PHASE A EVIDENCE GATHERING ======"

# --- A-01: axe-core / accessibility findings ---
Write-Host "`n--- A-01: Accessibility findings (axe-core) ---"
$aResp = (Invoke-WebRequest "$base/api/runs/79e86215-27d4-4dc2-bded-dbf80d28f8cf/findings?pageSize=50" -UseBasicParsing).Content | ConvertFrom-Json
$accessFindings = $aResp.data | Where-Object { $_.findingType -eq "accessibility" }
$visualFindings = $aResp.data | Where-Object { $_.findingType -ne "accessibility" }
Write-Host "Run 79e86 - Total: $($aResp.total)  Accessibility: $($accessFindings.Count)  Visual: $($visualFindings.Count)"
if ($accessFindings.Count -gt 0) {
    $af = $accessFindings[0]
    Write-Host "  Sample accessibility finding: ruleId=$($af.ruleId) severity=$($af.severity)"
    $evData = $af.evidence[0].additionalData | ConvertTo-Json -Depth 3
    Write-Host "  Evidence additionalData: $evData"
}

# --- A-02: suggestedFix present ---
Write-Host "`n--- A-02: suggestedFix in evidence ---"
$sfFindings = $aResp.data | Where-Object { $_.findingType -ne "accessibility" }
$withFix = $sfFindings | Where-Object { $_.evidence -and $_.evidence[0].additionalData -and $_.evidence[0].additionalData.suggestedFix }
Write-Host "Visual findings with suggestedFix: $($withFix.Count) / $($sfFindings.Count)"

# --- A-03: Review workflow ---
Write-Host "`n--- A-03: Review workflow (PATCH /api/findings/:id/review) ---"
$testFindingId = $aResp.data[0].id
$patchBody = '{"status":"acknowledged","note":"QA test - known spacing from grid migration"}'
try {
    $patchResp = Invoke-WebRequest "$base/api/findings/$testFindingId/review" -Method PATCH -ContentType "application/json" -Body $patchBody -UseBasicParsing
    Write-Host "PATCH review status: $($patchResp.StatusCode)"
    $patchData = $patchResp.Content | ConvertFrom-Json
    Write-Host "  reviewStatus=$($patchData.reviewStatus)  reviewedAt=$($patchData.reviewedAt)"
} catch {
    Write-Host "PATCH review FAILED: $($_.Exception.Message)"
    Write-Host "  StatusCode: $($_.Exception.Response.StatusCode)"
}

# --- A-03: Review filter ---
Write-Host "`n--- A-03: Filter by reviewStatus ---"
try {
    $openResp = (Invoke-WebRequest "$base/api/runs/79e86215-27d4-4dc2-bded-dbf80d28f8cf/findings?reviewStatus=acknowledged&pageSize=5" -UseBasicParsing).Content | ConvertFrom-Json
    Write-Host "  acknowledged findings count: $($openResp.total)"
} catch {
    Write-Host "  reviewStatus filter not supported: $($_.Exception.Message)"
}

# --- A-04: AI summary field ---
Write-Host "`n--- A-04: AI summary field on run ---"
$runResp = (Invoke-WebRequest "$base/api/runs/79e86215-27d4-4dc2-bded-dbf80d28f8cf" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  aiSummary field present: $($runResp.PSObject.Properties.Name -contains 'aiSummary')"
Write-Host "  aiSummary value: $($runResp.aiSummary)"

# --- A-05: Slack - create a run and check behavior ---
Write-Host "`n--- A-05: Slack notification (SLACK_WEBHOOK_URL unset) ---"
Write-Host "  Worker runs without SLACK_WEBHOOK_URL - checking if runs still complete..."
$proj2 = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"slack-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$run2Body = @{ projectId=$proj2.id; url="http://localhost:3000"; viewports=@("desktop") } | ConvertTo-Json
$run2 = (Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $run2Body -UseBasicParsing).Content | ConvertFrom-Json
$r2timeout=60; $r2elapsed=0
while ($r2elapsed -lt $r2timeout) {
    Start-Sleep 4; $r2elapsed += 4
    $r2status = ((Invoke-WebRequest "$base/api/runs/$($run2.id)" -UseBasicParsing).Content | ConvertFrom-Json).status
    if ($r2status -in @("rules_complete","complete","failed")) { break }
}
Write-Host "  Slack test run final status: $r2status (run completed without Slack = OK)"

# --- A-06: CLI package exists ---
Write-Host "`n--- A-06: CLI package check ---"
$cliExists = Test-Path "C:\Users\Hp\Documents\opendesign-qa\packages\cli"
Write-Host "  packages/cli directory exists: $cliExists"
if ($cliExists) {
    $pkgJson = Get-Content "C:\Users\Hp\Documents\opendesign-qa\packages\cli\package.json" -Raw | ConvertFrom-Json
    Write-Host "  CLI package name: $($pkgJson.name)"
    Write-Host "  CLI bin entries: $(($pkgJson.bin | ConvertTo-Json -Compress))"
}

# --- A-07: Multi-viewport run ---
Write-Host "`n--- A-07: Multi-viewport run (mobile+tablet+desktop) ---"
$proj3 = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"matrix-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$run3Body = @{ projectId=$proj3.id; url="http://localhost:3000"; viewports=@("mobile","tablet","desktop") } | ConvertTo-Json
$run3 = (Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $run3Body -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  Multi-viewport run created: $($run3.id)"
$r3timeout=90; $r3elapsed=0
while ($r3elapsed -lt $r3timeout) {
    Start-Sleep 4; $r3elapsed += 4
    $r3data = (Invoke-WebRequest "$base/api/runs/$($run3.id)" -UseBasicParsing).Content | ConvertFrom-Json
    $r3status = $r3data.status
    if ($r3status -in @("rules_complete","complete","failed")) { break }
}
Write-Host "  Multi-viewport run status: $r3status"
$r3findings = (Invoke-WebRequest "$base/api/runs/$($run3.id)/findings?pageSize=5" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "  Multi-viewport findings total: $($r3findings.total)"
# check viewport filter
try {
    $mobileF = (Invoke-WebRequest "$base/api/runs/$($run3.id)/findings?viewport=mobile&pageSize=5" -UseBasicParsing).Content | ConvertFrom-Json
    Write-Host "  viewport=mobile filter supported, count: $($mobileF.total)"
} catch {
    Write-Host "  viewport filter not supported: $($_.Exception.Message)"
}

Write-Host "`n====== PHASE A DONE ======"
