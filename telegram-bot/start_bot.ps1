$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot '.env.bot.local'
if (!(Test-Path $envPath)) { throw "Create telegram-bot/.env.bot.local first using .env.bot.example" }
foreach ($line in Get-Content $envPath) {
  $trim = $line.Trim()
  if ($trim -and !$trim.StartsWith('#')) {
    $parts = $trim.Split('=',2)
    if ($parts.Length -eq 2) { [Environment]::SetEnvironmentVariable($parts[0].Trim(),$parts[1].Trim(), 'Process') }
  }
}
python (Join-Path $PSScriptRoot 'flowusd_bot.py')
