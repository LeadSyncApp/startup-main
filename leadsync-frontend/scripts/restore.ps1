# Restore script for Supabase/Postgres
# Usage: .\scripts\restore.ps1 <backup_file>

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "❌ Backup file not found: $BackupFile"
    exit 1
}

Write-Host "⚠️  Restoring from $BackupFile..." -ForegroundColor Yellow
Write-Host "This will overwrite current data. Press Ctrl+C to cancel in 5s." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Load .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
         if ($_ -match "^(.*?)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    
    $DatabaseUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")

    # Run pg_restore
    try {
        pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DatabaseUrl" --verbose "$BackupFile"
        Write-Host "✅ Restore completed" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ Restore failed: $_"
    }
}
else {
    Write-Error "❌ .env file not found"
    exit 1
}
