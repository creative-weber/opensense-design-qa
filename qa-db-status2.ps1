$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Fixture run viewport_runs ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT id, viewport, status, error_code, error_message FROM viewport_runs WHERE audit_run_id = 'e3bf14f0-e155-4ed6-9134-6b7540883684';"

Write-Host "`n=== Findings for fixture run ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT f.rule_id, f.severity, COUNT(*) FROM findings f JOIN viewport_runs vr ON vr.id = f.viewport_run_id WHERE vr.audit_run_id = 'e3bf14f0-e155-4ed6-9134-6b7540883684' GROUP BY f.rule_id, f.severity;"

Write-Host "`n=== Latest run with most findings ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT vr.audit_run_id, ar.url, COUNT(f.id) as cnt FROM viewport_runs vr JOIN findings f ON f.viewport_run_id = vr.id JOIN audit_runs ar ON ar.id = vr.audit_run_id GROUP BY vr.audit_run_id, ar.url ORDER BY cnt DESC LIMIT 5;"

Write-Host "`n=== Total rules distribution ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT rule_id, severity, COUNT(*) FROM findings GROUP BY rule_id, severity ORDER BY COUNT(*) DESC LIMIT 15;"
