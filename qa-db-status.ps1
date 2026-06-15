$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Checking if review_status column already exists ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT column_name FROM information_schema.columns WHERE table_name='findings' AND column_name='review_status';"

Write-Host "`n=== Current findings columns ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='findings' ORDER BY ordinal_position;"

Write-Host "`n=== Current findings count ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c 'SELECT COUNT(*) FROM findings;'

Write-Host "`n=== Recent audit_runs ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c 'SELECT id, url, status, created_at FROM audit_runs ORDER BY created_at DESC LIMIT 8;'
