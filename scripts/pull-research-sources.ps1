<#
.SYNOPSIS
  Fetch complete read-only working-tree snapshots of public Foundry VTT v14 reference repos.
.DESCRIPTION
  Uses git clone into ignored research-sources/. Does not run upstream code or write any
  files into AMBA's source folders. Refuses to overwrite existing non-git directories.
.EXAMPLE
  ./scripts/pull-research-sources.ps1
  ./scripts/pull-research-sources.ps1 -Update
  ./scripts/pull-research-sources.ps1 -IncludePf2e
#>
param(
  [switch]$IncludePf2e,
  [switch]$Update
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is required. Install Git for Windows and rerun this script.'
}

$root = Split-Path -Parent $PSScriptRoot
$destRoot = Join-Path $root 'research-sources'
New-Item -Path $destRoot -ItemType Directory -Force | Out-Null

$repos = @(
  @{ Name = 'runegoblin-pf2e-encounter-builder'; Url = 'https://github.com/rune-goblin/pf2e-encounter-builder.git'; Branch = 'main' },
  @{ Name = 'runegoblin-foundrytemplate'; Url = 'https://github.com/rune-goblin/runegoblin-foundrytemplate.git'; Branch = 'main' },
  @{ Name = 'rusty-pf2e-encounter-builder'; Url = 'https://github.com/RustyJimjams/pf2e-encounter-builder.git'; Branch = 'main' },
  @{ Name = 'mk-compendiums'; Url = 'https://github.com/fchrysoulas/MK-Compendiums.git'; Branch = 'main' }
)
if ($IncludePf2e) {
  $repos += @{ Name = 'pf2e-v14-source'; Url = 'https://github.com/foundryvtt/pf2e.git'; Branch = 'v14-dev' }
}

$manifest = @()
foreach ($entry in $repos) {
  $dest = Join-Path $destRoot $entry.Name
  Write-Host "Research source: $($entry.Name)"
  if (Test-Path $dest) {
    if (-not (Test-Path (Join-Path $dest '.git'))) {
      throw "Refusing to overwrite non-Git directory: $dest"
    }
    if ($Update) {
      & git -C $dest pull --ff-only
      if ($LASTEXITCODE -ne 0) { throw "Failed to fast-forward: $($entry.Name)" }
    } else {
      Write-Host '  Existing checkout; pass -Update to refresh.'
    }
  } else {
    & git clone --depth 1 --branch $entry.Branch $entry.Url $dest
    if ($LASTEXITCODE -ne 0) { throw "Failed to clone: $($entry.Url)" }
  }

  $headSha = (& git -C $dest rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not read Git HEAD: $dest" }
  $manifest += [pscustomobject]@{
    repository = $entry.Url
    branch = $entry.Branch
    commit = $headSha
    location = $entry.Name
  }
  Write-Host "  $headSha"
}

$manifest | ConvertTo-Json -Depth 4 |
  Set-Content -Path (Join-Path $destRoot 'source-manifest.json') -Encoding utf8
Write-Host "Complete source checkouts and manifest are in: $destRoot"
