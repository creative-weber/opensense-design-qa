$envFile = Join-Path $PSScriptRoot ".env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*"?([^"]*)"?\s*$') {
        [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2])
    }
}
$env:ODQA_START_SERVER = "1"
Set-Location "$PSScriptRoot\apps\api"
npx tsx src/index.ts
