[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ResourceGroupName,
    [Parameter(Mandatory = $true)][string]$ContainerRegistryName,
    [Parameter(Mandatory = $true)][string]$BackendContainerAppName,
    [Parameter(Mandatory = $true)][string]$FrontendContainerAppName,
    [Parameter(Mandatory = $true)][string]$BackendUrl,
    [string]$BackendBootstrapJobName = "",
    [string]$ImageTag = (Get-Date -Format "yyyyMMddHHmmss")
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
$env:AZURE_CORE_NO_COLOR = "true"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

function Invoke-Az {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AzureRoot = Split-Path -Parent $ScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $AzureRoot)

$backendImage = "ai-avatar-backend:$ImageTag"
$frontendImage = "ai-avatar-frontend:$ImageTag"

Write-Host "Building backend image in ACR..." -ForegroundColor Cyan
Invoke-Az -FailureMessage "Backend ACR build failed." -Arguments @(
    "acr", "build",
    "--registry", $ContainerRegistryName,
    "--image", $backendImage,
    "--file", (Join-Path $AzureRoot "docker\backend.Dockerfile"),
    (Join-Path $RepoRoot "backend")
)

Write-Host "Updating backend Container App..." -ForegroundColor Cyan
Invoke-Az -FailureMessage "Backend Container App update failed." -Arguments @(
    "containerapp", "update",
    "--name", $BackendContainerAppName,
    "--resource-group", $ResourceGroupName,
    "--image", "$ContainerRegistryName.azurecr.io/$backendImage"
)

if (-not [string]::IsNullOrWhiteSpace($BackendBootstrapJobName)) {
    Write-Host "Updating backend bootstrap Container Apps Job..." -ForegroundColor Cyan
    Invoke-Az -FailureMessage "Backend bootstrap job update failed." -Arguments @(
        "containerapp", "job", "update",
        "--name", $BackendBootstrapJobName,
        "--resource-group", $ResourceGroupName,
        "--image", "$ContainerRegistryName.azurecr.io/$backendImage"
    )
}

Write-Host "Building frontend image in ACR..." -ForegroundColor Cyan
Invoke-Az -FailureMessage "Frontend ACR build failed." -Arguments @(
    "acr", "build",
    "--registry", $ContainerRegistryName,
    "--image", $frontendImage,
    "--file", (Join-Path $AzureRoot "docker\frontend.Dockerfile"),
    "--build-arg", "VITE_API_BASE_URL=$BackendUrl",
    (Join-Path $RepoRoot "frontend")
)

Write-Host "Updating frontend Container App..." -ForegroundColor Cyan
Invoke-Az -FailureMessage "Frontend Container App update failed." -Arguments @(
    "containerapp", "update",
    "--name", $FrontendContainerAppName,
    "--resource-group", $ResourceGroupName,
    "--image", "$ContainerRegistryName.azurecr.io/$frontendImage",
    "--set-env-vars", "BACKEND_URL=$BackendUrl"
)

Write-Host "Images deployed:" -ForegroundColor Green
Write-Host "  $ContainerRegistryName.azurecr.io/$backendImage"
Write-Host "  $ContainerRegistryName.azurecr.io/$frontendImage"
