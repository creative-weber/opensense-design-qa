$base = "http://localhost:3001"

Write-Host "====== PHASE B EVIDENCE GATHERING ======"

# --- B-01: Jira/Linear ticket creation ---
Write-Host "`n--- B-01: Jira/Linear ticket creation endpoint ---"
$findingId = "f6f1bd0b-150e-47af-b7e5-ac71c5b214e5"
try {
    $ticketResp = Invoke-WebRequest "$base/api/findings/$findingId/create-ticket" -Method POST -ContentType "application/json" -Body '{"provider":"jira"}' -UseBasicParsing
    Write-Host "POST create-ticket status=$($ticketResp.StatusCode)"
    Write-Host "  response: $($ticketResp.Content)"
} catch {
    $code = $_.Exception.Response.StatusCode
    Write-Host "POST create-ticket FAILED: HTTP $code - $($_.Exception.Message)"
}

# --- B-02: Ignore rules ---
Write-Host "`n--- B-02: Ignore rules (project-scoped) ---"
$proj = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"ignore-test"}' -UseBasicParsing).Content | ConvertFrom-Json
# Check if project-scoped ignore-rules endpoint exists
try {
    $irResp = Invoke-WebRequest "$base/api/projects/$($proj.id)/ignore-rules" -Method GET -UseBasicParsing
    Write-Host "GET /api/projects/:id/ignore-rules status=$($irResp.StatusCode)"
} catch {
    Write-Host "GET project ignore-rules FAILED: HTTP $($_.Exception.Response.StatusCode)"
}
try {
    $irPost = Invoke-WebRequest "$base/api/projects/$($proj.id)/ignore-rules" -Method POST -ContentType "application/json" -Body '{"ruleId":"typography-inconsistency","selector":".countdown-timer"}' -UseBasicParsing
    Write-Host "POST project ignore-rules status=$($irPost.StatusCode)"
    Write-Host "  response: $($irPost.Content)"
} catch {
    Write-Host "POST project ignore-rules FAILED: HTTP $($_.Exception.Response.StatusCode)"
}

# --- B-03: Cross-browser (browser field in POST /api/runs) ---
Write-Host "`n--- B-03: Cross-browser (webkit) run support ---"
$proj3 = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"crossbrowser-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$run3Body = @{ projectId=$proj3.id; url="http://localhost:3000"; viewports=@("desktop"); browser="webkit" } | ConvertTo-Json
try {
    $run3Resp = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $run3Body -UseBasicParsing
    Write-Host "POST run with browser=webkit status=$($run3Resp.StatusCode)"
    $run3Data = $run3Resp.Content | ConvertFrom-Json
    Write-Host "  browser field in response: $($run3Data.browser)"
    Write-Host "  run id: $($run3Data.id)"
} catch {
    Write-Host "POST run with browser=webkit FAILED: $($_.Exception.Message)"
}

# --- B-04: Sensitivity presets ---
Write-Host "`n--- B-04: Sensitivity presets in POST /api/runs ---"
$proj4 = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"sensitivity-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$run4Body = @{ projectId=$proj4.id; url="http://localhost:3000"; viewports=@("desktop"); sensitivityPreset="low" } | ConvertTo-Json
try {
    $run4Resp = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $run4Body -UseBasicParsing
    Write-Host "POST run with sensitivityPreset=low status=$($run4Resp.StatusCode)"
    $run4Data = $run4Resp.Content | ConvertFrom-Json
    Write-Host "  sensitivityPreset in response: $($run4Data.sensitivityPreset)"
} catch {
    Write-Host "POST run with sensitivityPreset FAILED: $($_.Exception.Message)"
}

# --- B-05: Bulk review ---
Write-Host "`n--- B-05: Bulk review endpoint ---"
$runId = "79e86215-27d4-4dc2-bded-dbf80d28f8cf"
$findings200 = (Invoke-WebRequest "$base/api/runs/$runId/findings?pageSize=5" -UseBasicParsing).Content | ConvertFrom-Json
$ids = $findings200.data[0..2].id
$bulkBody = @{ findingIds=$ids; status="acknowledged"; note="Grid migration 4px to 8px" } | ConvertTo-Json
try {
    $bulkResp = Invoke-WebRequest "$base/api/runs/$runId/findings/bulk-review" -Method PATCH -ContentType "application/json" -Body $bulkBody -UseBasicParsing
    Write-Host "PATCH bulk-review status=$($bulkResp.StatusCode)"
    Write-Host "  response: $($bulkResp.Content)"
} catch {
    Write-Host "PATCH bulk-review FAILED: HTTP $($_.Exception.Response.StatusCode)"
}

# --- B-06: Dark mode / theme in POST /api/runs ---
Write-Host "`n--- B-06: Multi-theme (dark mode) run support ---"
$proj6 = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"darkmode-test"}' -UseBasicParsing).Content | ConvertFrom-Json
$run6Body = @{ projectId=$proj6.id; url="http://localhost:3000"; viewports=@("desktop"); themes=@("light","dark") } | ConvertTo-Json
try {
    $run6Resp = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $run6Body -UseBasicParsing
    Write-Host "POST run with themes=[light,dark] status=$($run6Resp.StatusCode)"
    $run6Data = $run6Resp.Content | ConvertFrom-Json
    Write-Host "  themes in response: $($run6Data.themes)"
} catch {
    Write-Host "POST run with themes FAILED: $($_.Exception.Message)"
}

Write-Host "`n====== PHASE B DONE ======"
