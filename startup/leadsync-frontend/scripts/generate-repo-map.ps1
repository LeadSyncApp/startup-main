param(
    [string]$Root = ".",
    [int]$MaxDepth = 3
)

$ExcludeDirs = @(
    "node_modules", ".git", "dist", "build", ".next", ".turbo",
    "coverage", ".vercel", ".idea", ".vscode", "out", "target"
)

$ExcludeFiles = @(
    ".env", ".DS_Store"
)

$ResolvedRoot = (Resolve-Path $Root).Path
$OutFile = Join-Path $ResolvedRoot "REPO_MAP.md"

function Test-ExcludedDir {
    param([string]$Name)
    return $ExcludeDirs -contains $Name
}

function Test-ExcludedFile {
    param([string]$Name)
    return $ExcludeFiles -contains $Name
}

function Get-TreeLines {
    param(
        [string]$Path,
        [int]$Depth,
        [string]$Indent
    )

    if ($Depth -gt $MaxDepth) {
        return @()
    }

    $Lines = @()
    $Items = Get-ChildItem -LiteralPath $Path -Force |
        Sort-Object @{ Expression = { $_.PSIsContainer }; Descending = $true }, Name

    foreach ($Item in $Items) {
        if ($Item.PSIsContainer) {
            if (Test-ExcludedDir -Name $Item.Name) {
                continue
            }

            $Lines += "$Indent- $($Item.Name)/"
            $Lines += Get-TreeLines -Path $Item.FullName -Depth ($Depth + 1) -Indent ($Indent + "  ")
        }
        else {
            if (Test-ExcludedFile -Name $Item.Name) {
                continue
            }

            $Lines += "$Indent- $($Item.Name)"
        }
    }

    return $Lines
}

$Lines = @()
$Lines += "# REPO MAP"
$Lines += ""
$Lines += "_Generated automatically. Do not edit manually._"
$Lines += ""
$Lines += "- $(Split-Path $ResolvedRoot -Leaf)/"
$Lines += Get-TreeLines -Path $ResolvedRoot -Depth 1 -Indent "  "

$Lines | Set-Content -Path $OutFile -Encoding UTF8

Write-Host "Generated $OutFile"