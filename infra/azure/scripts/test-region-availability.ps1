[CmdletBinding()]
param(
    [string[]]$Locations = @("eastus", "westus3", "centralus", "southcentralus", "swedencentral", "uksouth", "francecentral", "southeastasia", "japaneast"),
    [string]$EnvironmentName = "dev",
    [string]$NamePrefix = "aicoach",
    [string]$GithubOwner = "huqianghui",
    [string]$GithubRepo = "AI-avatar-vibe-coding",
    [string]$GithubBranch = "main",
    [string]$ChatDeploymentName = "gpt-4o",
    [ValidateSet("Standard", "GlobalStandard", "DataZoneStandard")]
    [string]$ChatDeploymentSkuName = "Standard",
    [int]$ChatDeploymentCapacity = 120,
    [string]$VnetName = "",
    [string]$VnetAddressPrefix = "10.60.0.0/16",
    [string]$ContainerAppsSubnetPrefix = "10.60.0.0/23",
    [string]$PrivateEndpointsSubnetPrefix = "10.60.2.0/24",
    [switch]$StopOnFirstPass
)

$ErrorActionPreference = "Stop"

function New-TestParameters {
    param(
        [string]$Location,
        [string]$SubscriptionSuffix,
        [string]$TemplateFile,
        [string]$OutputPath
    )

    $regionToken = ($Location -replace "[^a-zA-Z0-9]", "").ToLowerInvariant()
    $acrName = "$($NamePrefix)$($EnvironmentName)$($SubscriptionSuffix)$($regionToken)acr".ToLowerInvariant()
    if ($acrName.Length -gt 50) {
        $acrName = $acrName.Substring(0, 50)
    }

    $storageToken = "$($NamePrefix)$($EnvironmentName)$($SubscriptionSuffix)$($regionToken)".ToLowerInvariant()
    if ($storageToken.Length -gt 22) {
        $storageToken = $storageToken.Substring(0, 22)
    }
    $storageName = "${storageToken}st"

    $parameters = [ordered]@{
        "`$schema" = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
        contentVersion = "1.0.0.0"
        parameters = [ordered]@{
            namePrefix = @{ value = $NamePrefix }
            environmentName = @{ value = $EnvironmentName }
            location = @{ value = $Location }
            containerRegistryName = @{ value = $acrName }
            storageAccountName = @{ value = $storageName }
            postgresAdminPassword = @{ value = "AzureP0stgres!2026" }
            jwtSecret = @{ value = "region-preflight-jwt-secret-not-used" }
            encryptionKey = @{ value = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }
            githubOwner = @{ value = $GithubOwner }
            githubRepo = @{ value = $GithubRepo }
            githubBranch = @{ value = $GithubBranch }
            githubEnvironmentName = @{ value = $EnvironmentName }
            chatDeploymentName = @{ value = $ChatDeploymentName }
            chatDeploymentSkuName = @{ value = $ChatDeploymentSkuName }
            chatDeploymentCapacity = @{ value = $ChatDeploymentCapacity }
            vnetName = @{ value = $VnetName }
            vnetAddressPrefix = @{ value = $VnetAddressPrefix }
            containerAppsSubnetPrefix = @{ value = $ContainerAppsSubnetPrefix }
            privateEndpointsSubnetPrefix = @{ value = $PrivateEndpointsSubnetPrefix }
        }
    }

    $parameters | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputPath -Encoding utf8NoBOM
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AzureRoot = Split-Path -Parent $ScriptRoot
$TemplateFile = Join-Path $AzureRoot "main.bicep"
$LocalDir = Join-Path $AzureRoot ".local"
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

Write-Host "Checking Azure CLI login..." -ForegroundColor Cyan
$account = az account show --output json | ConvertFrom-Json
$subscriptionSuffix = (($account.id -replace "-", "").Substring(0, 6)).ToLowerInvariant()

Write-Host "Validating Bicep..." -ForegroundColor Cyan
az bicep build --file $TemplateFile | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Bicep build failed."
}

$results = @()
foreach ($location in $Locations) {
    Write-Host ""
    Write-Host "Preflighting region: $location" -ForegroundColor Cyan

    $parametersPath = Join-Path $LocalDir "preflight-$location.parameters.json"
    New-TestParameters -Location $location -SubscriptionSuffix $subscriptionSuffix -TemplateFile $TemplateFile -OutputPath $parametersPath

    $deploymentName = "preflight-$NamePrefix-$EnvironmentName-$location-$(Get-Date -Format yyyyMMddHHmmss)"
    $output = az deployment sub what-if `
        --name $deploymentName `
        --location $location `
        --template-file $TemplateFile `
        --parameters "@$parametersPath" `
        --result-format ResourceIdOnly 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    Remove-Item -Path $parametersPath -Force

    if ($exitCode -eq 0) {
        Write-Host "PASS: $location" -ForegroundColor Green
        $results += [pscustomobject]@{ Location = $location; Status = "PASS"; Reason = "" }
        if ($StopOnFirstPass) {
            break
        }
    }
    else {
        $reason = ($output -split "`r?`n" | Where-Object {
            $_ -match "ERROR:|LocationIsOfferRestricted|InsufficientResourcesAvailable|InvalidTemplateDeployment|InvalidResourceProperties|ServiceModelDeprecated|Sku|Quota|NotAvailable|Conflict"
        } | Select-Object -First 8) -join " "
        if ([string]::IsNullOrWhiteSpace($reason)) {
            $reason = ($output -split "`r?`n" | Select-Object -Last 8) -join " "
        }
        Write-Host "FAIL: $location" -ForegroundColor Red
        Write-Host $reason
        $results += [pscustomobject]@{ Location = $location; Status = "FAIL"; Reason = $reason }
    }
}

Write-Host ""
Write-Host "Region preflight summary:" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$resultPath = Join-Path $LocalDir "region-preflight-results.json"
$results | ConvertTo-Json -Depth 10 | Set-Content -Path $resultPath -Encoding utf8NoBOM
Write-Host "Saved results to $resultPath"
