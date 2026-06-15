$base = "http://localhost:3001"

Write-Host "=== Testing findings API now returns DB data ==="
$runId = "79e86215-27d4-4dc2-bded-dbf80d28f8cf"
$resp = (Invoke-WebRequest "$base/api/runs/$runId/findings?pageSize=5" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "total=$($resp.total)  page=$($resp.page)  data.count=$($resp.data.Count)"

if ($resp.data.Count -gt 0) {
    $f = $resp.data[0]
    Write-Host "`nSample finding:"
    Write-Host "  id=$($f.id)"
    Write-Host "  ruleId=$($f.ruleId)"
    Write-Host "  findingType=$($f.findingType)"
    Write-Host "  severity=$($f.severity)"
    Write-Host "  title=$($f.title)"
    Write-Host "  evidence.count=$($f.evidence.Count)"
    if ($f.evidence.Count -gt 0) {
        Write-Host "  evidence[0].additionalData=$($f.evidence[0].additionalData | ConvertTo-Json -Compress -Depth 3)"
    }
}

Write-Host "`n=== Check for accessibility findings ==="
$allResp = (Invoke-WebRequest "$base/api/runs/$runId/findings?pageSize=200" -UseBasicParsing).Content | ConvertFrom-Json
$accessFindings = $allResp.data | Where-Object { $_.findingType -eq "accessibility" }
$visualFindings = $allResp.data | Where-Object { $_.findingType -ne "accessibility" }
Write-Host "Total=$($allResp.total)  Accessibility=$($accessFindings.Count)  Visual=$($visualFindings.Count)"

Write-Host "`n=== Rule distribution ==="
$allResp.data | Group-Object ruleId | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}

Write-Host "`n=== Test suggestedFix in additionalData ==="
$withFix = $visualFindings | Where-Object { $_.evidence -and $_.evidence[0] -and $_.evidence[0].additionalData -and $_.evidence[0].additionalData.suggestedFix }
Write-Host "Visual findings with suggestedFix: $($withFix.Count) / $($visualFindings.Count)"
if ($withFix.Count -gt 0) {
    Write-Host "  Example: $($withFix[0].evidence[0].additionalData.suggestedFix)"
}

Write-Host "`n=== Test PATCH /api/findings/:id/review ==="
$findingId = $allResp.data[0].id
$patchBody = '{"status":"acknowledged","note":"QA test - confirmed regression"}'
try {
    $patchResp = Invoke-WebRequest "$base/api/findings/$findingId/review" -Method PATCH -ContentType "application/json" -Body $patchBody -UseBasicParsing
    $patchData = $patchResp.Content | ConvertFrom-Json
    Write-Host "PATCH status=$($patchResp.StatusCode)  reviewStatus=$($patchData.reviewStatus)  reviewedAt=$($patchData.reviewedAt)"
} catch {
    Write-Host "PATCH FAILED: $($_.Exception.Message)"
}

Write-Host "`n=== Verify reviewed finding persists ==="
$resp2 = (Invoke-WebRequest "$base/api/runs/$runId/findings?pageSize=200" -UseBasicParsing).Content | ConvertFrom-Json
$reviewed = $resp2.data | Where-Object { $_.id -eq $findingId }
Write-Host "Finding $findingId after review:"
Write-Host "  isIgnored=$($reviewed.isIgnored)"
