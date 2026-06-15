$env:PGPASSWORD = "postgres"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
& $psql -h localhost -U postgres -d opendesign_qa -f "C:\Users\Hp\Documents\opendesign-qa\add-review-cols.sql" 2>&1
Write-Host "`n=== Verify ==="
& $psql -h localhost -U postgres -d opendesign_qa -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='findings' ORDER BY ordinal_position;"
