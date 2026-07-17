# Backup script for Supabase/Postgres
# Usage: .\scripts\backup.ps1

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = ".\backups"

# Ensure backup directory exists
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "📦 Starting backup at $Timestamp..."

# Load .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^(.*?)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    
    $DatabaseUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
    
    if (-not $DatabaseUrl) {
        Write-Error "❌ DATABASE_URL not found in .env"
        exit 1
    }

    # Run pg_dump
    # Note: pg_dump must be in your PATH or you need to specify the full path
    try {
        pg_dump "$DatabaseUrl" --format=custom --file="$BackupDir\backup_$Timestamp.dump" --verbose
        Write-Host "✅ Backup completed: $BackupDir\backup_$Timestamp.dump" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ Backup failed: $_"
    }
}
else {
    Write-Error "❌ .env file not found"
    exit 1
}
