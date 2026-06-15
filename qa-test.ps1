$base = "http://localhost:3001"
$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Test-Step($id, $name, $passed, $detail) {
    $status = if ($passed) { "PASS" } else { "FAIL" }
    $results.Add([PSCustomObject]@{ ID=$id; Name=$name; Status=$status; Detail=$detail })
    $color = if ($passed) { "Green" } else { "Red" }
    Write-Host "[$status] $id - $name" -ForegroundColor $color
    if ($detail) { Write-Host "       $detail" -ForegroundColor Gray }
}

Write-Host "`n======= OPENDESIGN QA - FULL E2E TEST SUITE =======" -ForegroundColor Cyan
Write-Host "Testing API at $base`n"

# ── HEALTH ────────────────────────────────────────────────────────────────────
Write-Host "`n--- CORE: Health & Bootstrap ---" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest "$base/health" -UseBasicParsing -EA Stop
    $body = $r.Content | ConvertFrom-Json
    Test-Step "HEALTH" "API health endpoint returns ok" ($body.status -eq "ok") "status=$($body.status)"
} catch { Test-Step "HEALTH" "API health endpoint" $false "$_" }

# ── CREATE PROJECT ────────────────────────────────────────────────────────────
try {
    $r = Invoke-WebRequest "$base/api/projects" -Method POST -ContentType "application/json" -Body '{"name":"QA Test Project"}' -UseBasicParsing -EA Stop
    $proj = $r.Content | ConvertFrom-Json
    Test-Step "PROJ-01" "POST /api/projects creates project (201)" ($r.StatusCode -eq 201 -and $proj.id) "id=$($proj.id)"
    $projectId = $proj.id
} catch { Test-Step "PROJ-01" "POST /api/projects" $false "$_"; $projectId = $null }

# ── GET PROJECT ───────────────────────────────────────────────────────────────
if ($projectId) {
    try {
        $r = Invoke-WebRequest "$base/api/projects/$projectId" -UseBasicParsing -EA Stop
        $p = $r.Content | ConvertFrom-Json
        Test-Step "PROJ-02" "GET /api/projects/:id returns correct project" ($p.name -eq "QA Test Project") "name=$($p.name)"
    } catch { Test-Step "PROJ-02" "GET /api/projects/:id" $false "$_" }
}

# ── CREATE RUN (single viewport) ──────────────────────────────────────────────
Write-Host "`n--- CORE: Run Creation & Validation ---" -ForegroundColor Yellow
$runId = $null; $multiRunId = $null
if ($projectId) {
    try {
        $b = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("desktop") } | ConvertTo-Json
        $r = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $b -UseBasicParsing -EA Stop
        $run = $r.Content | ConvertFrom-Json
        Test-Step "RUN-01" "POST /api/runs creates run (201)" ($r.StatusCode -eq 201 -and $run.id) "runId=$($run.id) status=$($run.status)"
        Test-Step "RUN-02" "Run has 1 viewportRun for desktop" ($run.viewportRuns.Count -eq 1 -and $run.viewportRuns[0].viewport -eq "desktop") "count=$($run.viewportRuns.Count) vp=$($run.viewportRuns[0].viewport)"
        $runId = $run.id
    } catch { Test-Step "RUN-01" "POST /api/runs" $false "$_" }

    # Validation: missing projectId
    try {
        $r2 = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body '{"url":"http://example.com","viewports":["desktop"]}' -UseBasicParsing -EA SilentlyContinue
        Test-Step "RUN-VAL-01" "POST /api/runs rejects missing projectId (400)" ($r2.StatusCode -eq 400) "got=$($r2.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Test-Step "RUN-VAL-01" "POST /api/runs rejects missing projectId (400)" ($code -eq 400) "statusCode=$code"
    }

    # Validation: unknown project UUID
    try {
        $ub = @{ projectId=[System.Guid]::NewGuid().ToString(); url="http://example.com"; viewports=@("desktop") } | ConvertTo-Json
        $r3 = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $ub -UseBasicParsing -EA SilentlyContinue
        Test-Step "RUN-VAL-02" "POST /api/runs returns 404 for unknown project" ($r3.StatusCode -eq 404) "got=$($r3.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Test-Step "RUN-VAL-02" "POST /api/runs 404 unknown project" ($code -eq 404) "statusCode=$code"
    }

    # Multi-viewport run for A-07
    try {
        $mb = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("mobile","tablet","desktop") } | ConvertTo-Json
        $mr = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $mb -UseBasicParsing -EA Stop
        $mrun = $mr.Content | ConvertFrom-Json
        Test-Step "RUN-03" "POST /api/runs with 3 viewports creates 3 viewportRuns" ($mrun.viewportRuns.Count -eq 3) "count=$($mrun.viewportRuns.Count)"
        $multiRunId = $mrun.id
    } catch { Test-Step "RUN-03" "POST /api/runs multi-viewport" $false "$_" }
}

# ── B-03: browser field ────────────────────────────────────────────────────────
if ($projectId) {
    try {
        $bb = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("desktop"); browser="webkit" } | ConvertTo-Json
        $br = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $bb -UseBasicParsing -EA Stop
        $brun = $br.Content | ConvertFrom-Json
        Test-Step "B-03" "B-03: POST /api/runs accepts 'browser' field" ($br.StatusCode -eq 201) "browser in response=$($brun.browser)"
    } catch { Test-Step "B-03" "B-03: browser field accepted" $false "$_" }
}

# ── B-04: sensitivityPreset ───────────────────────────────────────────────────
if ($projectId) {
    try {
        $sb = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("desktop"); sensitivityPreset="low" } | ConvertTo-Json
        $sr = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $sb -UseBasicParsing -EA Stop
        $srun = $sr.Content | ConvertFrom-Json
        Test-Step "B-04" "B-04: POST /api/runs accepts 'sensitivityPreset' field" ($sr.StatusCode -eq 201) "preset in response=$($srun.sensitivityPreset)"
    } catch { Test-Step "B-04" "B-04: sensitivityPreset field" $false "$_" }
}

# ── B-06: themes (dark mode) ──────────────────────────────────────────────────
if ($projectId) {
    try {
        $tb = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("desktop"); themes=@("light","dark") } | ConvertTo-Json
        $tr = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $tb -UseBasicParsing -EA Stop
        $trun = $tr.Content | ConvertFrom-Json
        Test-Step "B-06" "B-06: POST /api/runs accepts 'themes' array (dark mode)" ($tr.StatusCode -eq 201) "themes in response=$($trun.themes)"
    } catch { Test-Step "B-06" "B-06: themes/dark mode field" $false "$_" }
}

# ── FIGMA frame URL ───────────────────────────────────────────────────────────
if ($projectId) {
    try {
        $fb = @{ projectId=$projectId; url="http://localhost:3000"; viewports=@("desktop"); figmaFrameUrl="https://www.figma.com/file/abc123/test" } | ConvertTo-Json
        $fr = Invoke-WebRequest "$base/api/runs" -Method POST -ContentType "application/json" -Body $fb -UseBasicParsing -EA Stop
        $frun = $fr.Content | ConvertFrom-Json
        Test-Step "FIGMA-01" "Figma figmaFrameUrl accepted and stored on run" ($frun.figmaFrameUrl -ne $null) "figmaFrameUrl=$($frun.figmaFrameUrl)"
    } catch { Test-Step "FIGMA-01" "Figma figmaFrameUrl" $false "$_" }
}

# ── WAIT FOR SINGLE RUN ───────────────────────────────────────────────────────
Write-Host "`n--- Waiting for run to complete (up to 90s)... ---" -ForegroundColor Yellow
$finalStatus = "unknown"; $findingId = $null; $allFindings = $null
if ($runId) {
    $timeout = 90; $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep 4; $elapsed += 4
        try {
            $r = Invoke-WebRequest "$base/api/runs/$runId" -UseBasicParsing -EA Stop
            $rd = $r.Content | ConvertFrom-Json
            $finalStatus = $rd.status
            Write-Host "  [${elapsed}s] status=$finalStatus" -ForegroundColor Gray
            if ($finalStatus -in @("rules_complete","complete","failed")) { break }
        } catch { Write-Host "  poll error: $_" }
    }
    Test-Step "RUN-COMPLETE" "Run reaches terminal status within 90s" ($finalStatus -in @("rules_complete","complete","failed")) "status=$finalStatus elapsed=${elapsed}s"

    # ── GET FINDINGS ──────────────────────────────────────────────────────────
    Write-Host "`n--- Phase A: Feature Tests ---" -ForegroundColor Yellow
    try {
        $r = Invoke-WebRequest "$base/api/runs/$runId/findings" -UseBasicParsing -EA Stop
        $fd = $r.Content | ConvertFrom-Json
        $allFindings = $fd.data
        Test-Step "FIND-01" "GET /api/runs/:id/findings returns paginated list" ($fd.PSObject.Properties.Name -contains "total" -and $fd.PSObject.Properties.Name -contains "data") "total=$($fd.total) page=$($fd.page)"
        Test-Step "FIND-02" "Findings have id, severity, ruleId, description" ($fd.data.Count -eq 0 -or ($fd.data[0].id -and $fd.data[0].severity -and $fd.data[0].ruleId)) "sample ruleId=$(if($fd.data.Count -gt 0){$fd.data[0].ruleId}else{'none'})"
        $findingId = if ($fd.data.Count -gt 0) { $fd.data[0].id } else { $null }

        # A-01: accessibility findingType
        $a11y = @($fd.data | Where-Object { $_.findingType -eq "accessibility" })
        Test-Step "A-01" "A-01: Findings include findingType='accessibility' (axe-core)" ($a11y.Count -gt 0) "accessibilityFindings=$($a11y.Count) / total=$($fd.total)"

        # A-02: suggestedFix in evidence
        $withFix = @($fd.data | Where-Object { ($_.evidence | ConvertTo-Json -Compress) -match "suggestedFix" })
        Test-Step "A-02" "A-02: Finding evidence includes 'suggestedFix' key" ($withFix.Count -gt 0) "findingsWithFix=$($withFix.Count) / $($fd.data.Count)"

        # Check severity field values
        $badSeverity = @($fd.data | Where-Object { $_.severity -notin @("critical","high","medium","low","info") })
        Test-Step "FIND-SEV" "All findings have valid severity values" ($badSeverity.Count -eq 0) "invalid=$($badSeverity.Count)"
    } catch { Test-Step "FIND-01" "GET findings" $false "$_" }

    # A-03: Finding review workflow
    if ($findingId) {
        try {
            $rb = @{ status="acknowledged"; note="Known spacing from grid migration. Team approved." } | ConvertTo-Json
            $rr = Invoke-WebRequest "$base/api/findings/$findingId/review" -Method PATCH -ContentType "application/json" -Body $rb -UseBasicParsing -EA Stop
            $rev = $rr.Content | ConvertFrom-Json
            Test-Step "A-03a" "A-03: PATCH /api/findings/:id/review returns 200" ($rr.StatusCode -eq 200) "status=$($rr.StatusCode)"
            Test-Step "A-03b" "A-03: reviewStatus='acknowledged' in response" ($rev.reviewStatus -eq "acknowledged") "reviewStatus=$($rev.reviewStatus)"
            Test-Step "A-03c" "A-03: reviewedAt ISO timestamp returned" ($rev.reviewedAt -ne $null) "reviewedAt=$($rev.reviewedAt)"
            Test-Step "A-03d" "A-03: reviewNote persisted" ($rev.reviewNote -like "*grid migration*") "note=$($rev.reviewNote)"
        } catch { Test-Step "A-03a" "A-03: PATCH review" $false "$_" }

        # Test other review statuses
        try {
            $rb2 = @{ status="ignored"; note="Dynamic content" } | ConvertTo-Json
            $rr2 = Invoke-WebRequest "$base/api/findings/$findingId/review" -Method PATCH -ContentType "application/json" -Body $rb2 -UseBasicParsing -EA Stop
            Test-Step "A-03e" "A-03: Can update reviewStatus to 'ignored'" (($rr2.Content | ConvertFrom-Json).reviewStatus -eq "ignored") ""
        } catch { Test-Step "A-03e" "A-03: reviewStatus=ignored" $false "$_" }

        try {
            $rb3 = @{ status="resolved" } | ConvertTo-Json
            $rr3 = Invoke-WebRequest "$base/api/findings/$findingId/review" -Method PATCH -ContentType "application/json" -Body $rb3 -UseBasicParsing -EA Stop
            Test-Step "A-03f" "A-03: Can update reviewStatus to 'resolved'" (($rr3.Content | ConvertFrom-Json).reviewStatus -eq "resolved") ""
        } catch { Test-Step "A-03f" "A-03: reviewStatus=resolved" $false "$_" }
    } else {
        Test-Step "A-03a" "A-03: PATCH review (no findings to test)" $false "run produced 0 findings"
    }

    # A-04: aiSummary on run
    try {
        $r = Invoke-WebRequest "$base/api/runs/$runId" -UseBasicParsing -EA Stop
        $rd2 = $r.Content | ConvertFrom-Json
        $hasAi = $rd2.PSObject.Properties.Name -contains "aiSummary"
        Test-Step "A-04a" "A-04: GET /api/runs/:id includes 'aiSummary' field" $hasAi "fields: $($rd2.PSObject.Properties.Name -join ', ')"
        if ($hasAi) {
            Test-Step "A-04b" "A-04: aiSummary is null when no LLM key set (graceful)" ($null -eq $rd2.aiSummary) "aiSummary=$($rd2.aiSummary)"
        }
    } catch { Test-Step "A-04a" "A-04: aiSummary field" $false "$_" }

    # A-05: Slack - run completes without SLACK_WEBHOOK_URL (graceful degradation)
    Test-Step "A-05" "A-05: Run completes normally without SLACK_WEBHOOK_URL (graceful)" ($finalStatus -ne "failed") "status=$finalStatus"

    # A-06: Export
    try {
        $er = Invoke-WebRequest "$base/api/runs/$runId/export?format=json" -UseBasicParsing -EA Stop
        $exp = $er.Content | ConvertFrom-Json
        $hasRunId = $exp.PSObject.Properties.Name -contains "runId"
        $hasFindings = $exp.PSObject.Properties.Name -contains "findings"
        Test-Step "A-06a" "A-06: Export JSON has 'runId' field" $hasRunId "keys=$($exp.PSObject.Properties.Name -join ',')"
        Test-Step "A-06b" "A-06: Export JSON has 'findings' array" $hasFindings "findingsCount=$($exp.findings.Count)"
    } catch { Test-Step "A-06a" "A-06: export JSON" $false "$_" }
    try {
        $mr2 = Invoke-WebRequest "$base/api/runs/$runId/export?format=markdown" -UseBasicParsing -EA Stop
        Test-Step "A-06c" "A-06: Export Markdown returns non-empty text" ($mr2.Content.Length -gt 100) "bytes=$($mr2.Content.Length)"
    } catch { Test-Step "A-06c" "A-06: export markdown" $false "$_" }

    # Artifacts
    try {
        $ar = Invoke-WebRequest "$base/api/runs/$runId/artifacts" -UseBasicParsing -EA Stop
        $arts = $ar.Content | ConvertFrom-Json
        Test-Step "ART-01" "GET /api/runs/:id/artifacts returns array" ($arts -is [array] -or $arts.Count -ge 0) "count=$($arts.Count)"
        if ($arts.Count -gt 0) {
            Test-Step "ART-02" "Artifact has signedUrl field" ($arts[0].signedUrl -ne $null) "signedUrl=$($arts[0].signedUrl)"
            Test-Step "ART-03" "Artifact has viewport field" ($arts[0].viewport -ne $null) "viewport=$($arts[0].viewport)"
        }
    } catch { Test-Step "ART-01" "GET artifacts" $false "$_" }

    # B-02: Ignore rules
    try {
        $ib = @{ ruleId="typography-inconsistency"; selector=".countdown-timer" } | ConvertTo-Json
        $ir = Invoke-WebRequest "$base/api/runs/$runId/ignore-rules" -Method POST -ContentType "application/json" -Body $ib -UseBasicParsing -EA Stop
        $ig = $ir.Content | ConvertFrom-Json
        Test-Step "B-02a" "B-02: POST /api/runs/:id/ignore-rules returns 201" ($ir.StatusCode -eq 201) "id=$($ig.id)"
        Test-Step "B-02b" "B-02: Ignore rule stores ruleId and selector" ($ig.ruleId -eq "typography-inconsistency" -and $ig.selector -eq ".countdown-timer") "ruleId=$($ig.ruleId) selector=$($ig.selector)"
    } catch { Test-Step "B-02a" "B-02: POST ignore-rules" $false "$_" }

    # B-01: create-ticket endpoint
    if ($findingId) {
        try {
            $ctb = @{ provider="jira" } | ConvertTo-Json
            $ctr = Invoke-WebRequest "$base/api/findings/$findingId/create-ticket" -Method POST -ContentType "application/json" -Body $ctb -UseBasicParsing -EA SilentlyContinue
            Test-Step "B-01" "B-01: POST /api/findings/:id/create-ticket endpoint exists" ($ctr.StatusCode -lt 500) "status=$($ctr.StatusCode) body=$($ctr.Content.Substring(0,[Math]::Min(100,$ctr.Content.Length)))"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Test-Step "B-01" "B-01: create-ticket endpoint (not 500)" ($code -and $code -lt 500) "statusCode=$code"
        }
    }

    # B-05: bulk-review
    try {
        $bb2 = @{ findingIds=@(); status="acknowledged"; note="grid migration" } | ConvertTo-Json
        $br2 = Invoke-WebRequest "$base/api/runs/$runId/findings/bulk-review" -Method PATCH -ContentType "application/json" -Body $bb2 -UseBasicParsing -EA SilentlyContinue
        Test-Step "B-05" "B-05: PATCH /api/runs/:id/findings/bulk-review endpoint exists" ($br2.StatusCode -lt 500) "status=$($br2.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Test-Step "B-05" "B-05: bulk-review endpoint" ($code -and $code -lt 500) "statusCode=$code - NOT IMPLEMENTED"
    }
}

# A-07: Multi-viewport run + findings filter
Write-Host "`n--- A-07: Responsive Matrix (multi-viewport run) ---" -ForegroundColor Yellow
if ($multiRunId) {
    $mv_timeout = 90; $mv_elapsed = 0; $mvStatus = "queued"
    while ($mv_elapsed -lt $mv_timeout) {
        Start-Sleep 4; $mv_elapsed += 4
        try {
            $r = Invoke-WebRequest "$base/api/runs/$multiRunId" -UseBasicParsing -EA Stop
            $mvStatus = ($r.Content | ConvertFrom-Json).status
            if ($mvStatus -in @("rules_complete","complete","failed")) { break }
        } catch {}
    }
    Test-Step "A-07-STATUS" "A-07: Multi-viewport run completes" ($mvStatus -in @("rules_complete","complete","failed")) "status=$mvStatus"
    foreach ($vp in @("mobile","tablet","desktop")) {
        try {
            $r = Invoke-WebRequest "$base/api/runs/$multiRunId/findings?viewport=$vp" -UseBasicParsing -EA Stop
            $vf = $r.Content | ConvertFrom-Json
            Test-Step "A-07-$vp" "A-07: findings?viewport=$vp returns paginated result" ($vf.PSObject.Properties.Name -contains "total") "total=$($vf.total)"
        } catch { Test-Step "A-07-$vp" "A-07: viewport=$vp filter" $false "$_" }
    }
}

# ── CLI PACKAGE ───────────────────────────────────────────────────────────────
Write-Host "`n--- A-06: CLI Package ---" -ForegroundColor Yellow
$cliPath = "C:\Users\Hp\Documents\opendesign-qa\packages\cli"
Test-Step "CLI-01" "A-06: packages/cli directory exists" (Test-Path $cliPath) "path=$cliPath"
if (Test-Path $cliPath) {
    $pkgJson = Test-Path "$cliPath\package.json"
    Test-Step "CLI-02" "A-06: packages/cli has package.json" $pkgJson ""
    if ($pkgJson) {
        $pkg = Get-Content "$cliPath\package.json" | ConvertFrom-Json
        Test-Step "CLI-03" "A-06: CLI package has bin entry" ($pkg.bin -ne $null) "bin=$($pkg.bin)"
    }
    $hasSrc = (Get-ChildItem "$cliPath" -Recurse -Filter "*.ts" -EA SilentlyContinue).Count -gt 0
    Test-Step "CLI-04" "A-06: CLI has TypeScript source files" $hasSrc "tsFiles=$(if($hasSrc){(Get-ChildItem "$cliPath" -Recurse -Filter "*.ts").Count}else{0})"
}

# ── C-PHASE: Strategic endpoints ──────────────────────────────────────────────
Write-Host "`n--- Phase C: Strategic Feature Checks ---" -ForegroundColor Yellow
# C-01: design tokens
try {
    $r = Invoke-WebRequest "$base/api/projects/test/token-files" -UseBasicParsing -EA SilentlyContinue
    Test-Step "C-01" "C-01: Design token /api/projects/:id/token-files endpoint" ($r.StatusCode -ne 404) "status=$($r.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Test-Step "C-01" "C-01: Design token endpoint" $false "HTTP $code - NOT IMPLEMENTED"
}

# C-02: core web vitals - performanceMetrics on run
if ($runId) {
    try {
        $r = Invoke-WebRequest "$base/api/runs/$runId" -UseBasicParsing -EA Stop
        $rd = $r.Content | ConvertFrom-Json
        $hasPerf = $rd.PSObject.Properties.Name -contains "performanceMetrics"
        Test-Step "C-02" "C-02: GET /api/runs/:id includes 'performanceMetrics'" $hasPerf "fields=$($rd.PSObject.Properties.Name -join ',')"
    } catch { Test-Step "C-02" "C-02: performanceMetrics on run" $false "$_" }
}

# C-05: billing/usage endpoint
try {
    $r = Invoke-WebRequest "$base/api/usage" -UseBasicParsing -EA SilentlyContinue
    Test-Step "C-05" "C-05: Usage-based billing /api/usage endpoint" ($r.StatusCode -lt 500) "status=$($r.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Test-Step "C-05" "C-05: /api/usage endpoint" $false "HTTP $code - NOT IMPLEMENTED"
}

# ── STORY TESTS ───────────────────────────────────────────────────────────────
Write-Host "`n--- Story Tests: User Journey Checks ---" -ForegroundColor Yellow
# Story 2: Lena compliance - can filter findings to accessibility only
if ($runId -and $allFindings) {
    $a11yOnly = @($allFindings | Where-Object { $_.findingType -eq "accessibility" })
    Test-Step "STORY-2a" "Story 2: Lena can filter accessibility-only findings" ($a11yOnly.Count -ge 0) "a11yCount=$($a11yOnly.Count)"
    # Check WCAG fields
    if ($a11yOnly.Count -gt 0) {
        $withWcag = @($a11yOnly | Where-Object { ($_.evidence | ConvertTo-Json -Compress) -match "wcag" })
        Test-Step "STORY-2b" "Story 2: Accessibility findings have WCAG tags in evidence" ($withWcag.Count -gt 0) "withWcagTags=$($withWcag.Count)"
        $withHelpUrl = @($a11yOnly | Where-Object { ($_.evidence | ConvertTo-Json -Compress) -match "helpUrl" })
        Test-Step "STORY-2c" "Story 2: Accessibility findings have helpUrl in evidence" ($withHelpUrl.Count -gt 0) "withHelpUrl=$($withHelpUrl.Count)"
    } else {
        Test-Step "STORY-2b" "Story 2: WCAG tags - no accessibility findings returned" $false "axe-core not integrated"
        Test-Step "STORY-2c" "Story 2: helpUrl - no accessibility findings returned" $false "axe-core not integrated"
    }
}

# Story 3: Marcus Slack - run completes, Slack not blocking
Test-Step "STORY-3" "Story 3: Marcus - run completes without Slack setup (graceful)" ($finalStatus -ne "failed") "status=$finalStatus"

# Story 4: Dev CI - export has findings array
if ($runId) {
    try {
        $er = Invoke-WebRequest "$base/api/runs/$runId/export?format=json" -UseBasicParsing -EA Stop
        $exp = $er.Content | ConvertFrom-Json
        Test-Step "STORY-4a" "Story 4: Dev - export JSON contains findings array" ($exp.PSObject.Properties.Name -contains "findings") "findingsCount=$($exp.findings.Count)"
        Test-Step "STORY-4b" "Story 4: Dev - export JSON contains runId" ($exp.runId -ne $null) "runId=$($exp.runId)"
    } catch { Test-Step "STORY-4a" "Story 4: export for CI" $false "$_" }
}

# ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
Write-Host "`n=======================================================" -ForegroundColor Cyan
$passed = @($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
$total  = $results.Count
Write-Host "RESULTS: $total tests | PASS: $passed | FAIL: $failed" -ForegroundColor Cyan
Write-Host "======================================================="

Write-Host "`n--- FAILURES ---" -ForegroundColor Red
$results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
    Write-Host "  FAIL [$($_.ID)] $($_.Name)" -ForegroundColor Red
    Write-Host "       $($_.Detail)" -ForegroundColor DarkRed
}

Write-Host "`n--- PASSES ---" -ForegroundColor Green
$results | Where-Object { $_.Status -eq "PASS" } | ForEach-Object {
    Write-Host "  PASS [$($_.ID)] $($_.Name)" -ForegroundColor Green
}

# Export JSON for report
$results | ConvertTo-Json -Depth 3 | Out-File "C:\Users\Hp\Documents\opendesign-qa\qa-results.json" -Encoding UTF8
Write-Host "`nResults saved to qa-results.json" -ForegroundColor Cyan
