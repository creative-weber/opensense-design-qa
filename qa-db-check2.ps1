$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$conn = "-h localhost -U opendesign -d opendesign_qa"

Write-Host "=== Tables ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c '\dt public.*'

Write-Host "`n=== Migration history ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;'
