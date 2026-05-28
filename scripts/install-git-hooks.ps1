Param()

# Copies hook templates from .githooks to .git/hooks
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$githooksSrc = Join-Path $repoRoot '..\.githooks' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $githooksSrc) {
  $githooksSrc = Join-Path $repoRoot '.githooks'
}
$githooksSrc = (Resolve-Path $githooksSrc).ProviderPath

$gitHooksDest = Join-Path $repoRoot '..\.git\hooks' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $gitHooksDest) {
  $gitHooksDest = Join-Path $repoRoot '.git\hooks'
}
$gitHooksDest = (Resolve-Path $gitHooksDest).ProviderPath

if (-not (Test-Path $githooksSrc)) {
  Write-Error ".githooks directory not found: $githooksSrc"
  exit 1
}

Write-Output "Installing git hooks from $githooksSrc to $gitHooksDest"

Get-ChildItem -Path $githooksSrc -File | ForEach-Object {
  $src = $_.FullName
  $dest = Join-Path $gitHooksDest $_.Name
  Copy-Item -Path $src -Destination $dest -Force
  # Ensure executable bit where possible
  try { icacls $dest /grant "%USERNAME%:RX" | Out-Null } catch {}
  Write-Output "Installed hook: $($_.Name)"
}

Write-Output "Git hooks installed. To test, try 'git push' and verify pushes to 'main' are blocked." 
