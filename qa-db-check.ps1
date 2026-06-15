$pg = "postgresql://opendesign:opendesign@localhost:5432/opendesign_qa"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

Write-Host "=== Recent AuditRuns ==="
& $psql $pg -c 'SELECT id, url, status, "createdAt" FROM "AuditRun" ORDER BY "createdAt" DESC LIMIT 5' 2>&1

Write-Host "`n=== ViewportRun statuses ==="
& $psql $pg -c 'SELECT vr.id, vr.viewport, vr.status, vr."errorCode", vr."errorMessage" FROM "ViewportRun" vr JOIN "AuditRun" ar ON ar.id = vr."auditRunId" ORDER BY ar."createdAt" DESC LIMIT 10' 2>&1

Write-Host "`n=== Findings count per run ==="
& $psql $pg -c 'SELECT vr."auditRunId", vr.viewport, COUNT(f.id) as cnt FROM "ViewportRun" vr LEFT JOIN "Finding" f ON f."viewportRunId" = vr.id GROUP BY vr."auditRunId", vr.viewport ORDER BY vr."auditRunId" DESC LIMIT 10' 2>&1

Write-Host "`n=== Total findings ==="
& $psql $pg -c 'SELECT COUNT(*) FROM "Finding"' 2>&1

Write-Host "`n=== Rule distribution ==="
& $psql $pg -c 'SELECT "ruleId", severity, COUNT(*) FROM "Finding" GROUP BY "ruleId", severity ORDER BY COUNT(*) DESC LIMIT 15' 2>&1
