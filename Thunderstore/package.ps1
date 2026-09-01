[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $PSScriptRoot "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version_number
$stagingDirectory = Join-Path $PSScriptRoot "staging"
$archivePath = Join-Path $PSScriptRoot "$($manifest.name)-$version.zip"
$releaseDirectory = Join-Path $projectRoot "bin\Release\net472"
$pluginPath = Join-Path $releaseDirectory "Bigfrost_ServerPortal.dll"
$pluginDirectory = Join-Path $stagingDirectory "BepInEx\plugins\Bigfrost_ServerPortal"

if (-not $SkipBuild)
{
    # 1. Build React web frontend into single-file dist/index.html
    Write-Host "Building web frontend with npm run build..." -ForegroundColor Cyan
    cmd.exe /c "npm --prefix `"$projectRoot`" run build"
    if ($LASTEXITCODE -ne 0)
    {
        throw "Frontend build failed; package creation stopped."
    }

    # 2. Build C# BepInEx Plugin embedding dist/index.html
    $dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($null -ne $dotnetCommand)
    {
        $dotnetPath = $dotnetCommand.Source
    }
    elseif (Test-Path (Join-Path $env:ProgramFiles "dotnet\dotnet.exe"))
    {
        $dotnetPath = Join-Path $env:ProgramFiles "dotnet\dotnet.exe"
    }
    else
    {
        throw "The .NET SDK was not found. Install a current .NET SDK before packaging."
    }

    Write-Host "Building C# plugin with dotnet build..." -ForegroundColor Cyan
    & $dotnetPath clean (Join-Path $projectRoot "Bifrostheim.csproj") -c Release --nologo
    & $dotnetPath build (Join-Path $projectRoot "Bifrostheim.csproj") -c Release --no-incremental --nologo
    if ($LASTEXITCODE -ne 0)
    {
        throw "Release build failed; package creation stopped."
    }
}

$pluginVersion = Select-String -Path (Join-Path $projectRoot "BifrostheimPlugin.cs") -Pattern 'PluginVersion\s*=\s*"([^"]+)"' |
    Select-Object -First 1
if ($null -eq $pluginVersion -or $pluginVersion.Matches[0].Groups[1].Value -ne $version)
{
    throw "BifrostheimPlugin.cs and manifest.json must use the same version number."
}

$requiredFiles = @(
    (Join-Path $projectRoot "README.md"),
    (Join-Path $projectRoot "CHANGELOG.md"),
    $manifestPath,
    (Join-Path $PSScriptRoot "icon.png"),
    $pluginPath
)

foreach ($file in $requiredFiles)
{
    if (-not (Test-Path $file))
    {
        throw "Required package file is missing: $file"
    }
}

Remove-Item $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
New-Item $stagingDirectory -ItemType Directory | Out-Null

foreach ($file in $requiredFiles)
{
    $fileName = Split-Path $file -Leaf
    if ($fileName -eq "Bigfrost_ServerPortal.dll")
    {
        New-Item $pluginDirectory -ItemType Directory -Force | Out-Null
        Copy-Item $file -Destination $pluginDirectory
    }
    else
    {
        Copy-Item $file -Destination $stagingDirectory
    }
}

Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $archivePath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try
{
    $expectedEntries = @(
        "README.md",
        "CHANGELOG.md",
        "manifest.json",
        "icon.png",
        "BepInEx/plugins/Bigfrost_ServerPortal/Bigfrost_ServerPortal.dll"
    )
    $actualEntries = @(
        $archive.Entries |
            Where-Object { -not $_.FullName.EndsWith("\") } |
            ForEach-Object { $_.FullName.Replace("\", "/") }
    )
    $missingEntries = @($expectedEntries | Where-Object { $_ -notin $actualEntries })
    $unexpectedEntries = @($actualEntries | Where-Object { $_ -notin $expectedEntries })

    if ($missingEntries.Count -gt 0 -or $unexpectedEntries.Count -gt 0)
    {
        throw "Invalid archive contents. Missing: $($missingEntries -join ', '); unexpected: $($unexpectedEntries -join ', ')."
    }
}
finally
{
    $archive.Dispose()
}

Write-Host "Created Thunderstore package: $archivePath" -ForegroundColor Green
