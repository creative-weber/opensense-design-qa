$root = $PSScriptRoot
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*"?([^"]*)"?\s*$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2])
        }
    }
}

Write-Host "Running DB migrations..."
Set-Location "$root\packages\db"
npx prisma migrate deploy 2>&1
Write-Host "Migration done. Exit: $LASTEXITCODE"
