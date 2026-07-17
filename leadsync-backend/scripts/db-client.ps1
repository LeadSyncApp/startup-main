# Run prisma generate only if schema.prisma is newer than the generated client.
# On Windows, prisma generate renames over node_modules\.prisma\client\query_engine-windows.dll.node,
# which fails with EPERM if any other node.exe still has the DLL loaded. Skipping
# when the client is already in sync avoids the file lock on every boot.
$ErrorActionPreference = "Stop"

$repoRoot   = Split-Path -Parent $PSScriptRoot
$schemaPath = Join-Path $repoRoot "prisma\schema.prisma"
$generated  = Join-Path $repoRoot "node_modules\.prisma\client\index.d.ts"

if (-not (Test-Path -LiteralPath $schemaPath)) {
  Write-Host "[db-client] Schema not found at $schemaPath. Running prisma generate anyway."
  & npx prisma generate
  exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $generated)) {
  Write-Host "[db-client] No generated client found. Running prisma generate."
  & npx prisma generate
  exit $LASTEXITCODE
}

$schemaTime = (Get-Item -LiteralPath $schemaPath).LastWriteTimeUtc
$genTime    = (Get-Item -LiteralPath $generated).LastWriteTimeUtc

if ($schemaTime -gt $genTime) {
  Write-Host "[db-client] Schema is newer than generated client. Regenerating."
  try {
    & npx prisma generate
  } catch {
    Write-Host ""
    Write-Host "[db-client] prisma generate failed. Common cause on Windows:" -ForegroundColor Yellow
    Write-Host "  Another node.exe is still holding the Prisma DLL open." -ForegroundColor Yellow
    Write-Host "  Fix:  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force" -ForegroundColor Yellow
    Write-Host "  Then re-run your npm script." -ForegroundColor Yellow
    throw
  }
} else {
  Write-Host "[db-client] Generated client is up to date. Skipping."
}