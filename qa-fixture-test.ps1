$base = "http://localhost:3001"

$proj = (Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"fixture-test"}' -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "Project: $($proj.id)"

$body = @{ projectId=$proj.id; url="http://localhost:3000/fixtures/test-landing"; viewports=@("desktop") } | ConvertTo-Json
$run = (Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "Run: $($run.id)"

$timeout=90; $elapsed=0; $status="queued"
while ($elapsed -lt $timeout) {
    Start-Sleep 4; $elapsed += 4
    $rd = (Invoke-WebRequest "$base/api/runs/$($run.id)" -UseBasicParsing).Content | ConvertFrom-Json
    $status = $rd.status
    Write-Host "[$elapsed] status=$status"
    if ($status -in @("rules_complete","complete","failed")) { break }
}

$fd = (Invoke-WebRequest "$base/api/runs/$($run.id)/findings?pageSize=10" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "FINDINGS total=$($fd.total)"
foreach ($f in $fd.data) {
    Write-Host "  ruleId=$($f.ruleId) severity=$($f.severity) findingType=$($f.findingType)"
}

$arts = (Invoke-WebRequest "$base/api/runs/$($run.id)/artifacts" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "ARTIFACTS count=$($arts.Count)"
foreach ($a in $arts) {
    Write-Host "  type=$($a.artifactType) vp=$($a.viewport) source=$($a.source)"
}
