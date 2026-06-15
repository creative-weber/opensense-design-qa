$envFile = Join-Path $PSScriptRoot ".env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*"?([^"]*)"?\s*$') {
        [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2])
    }
}
Set-Location "$PSScriptRoot\apps\web"
npx next dev --port 3000
