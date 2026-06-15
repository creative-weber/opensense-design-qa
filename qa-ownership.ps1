$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Table ownership ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

Write-Host "`n=== Test SELECT on findings (should work) ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT COUNT(*) FROM findings;" 2>&1

Write-Host "`n=== Test findings columns (does review_status exist?) ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT column_name FROM information_schema.columns WHERE table_name='findings' AND column_name IN ('review_status','review_note','reviewed_at');"

Write-Host "`n=== Prisma schema vs DB - check _prisma_migrations ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at;"
