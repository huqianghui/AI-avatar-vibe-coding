# Azure deployment operations

Run commands from the repository root on Windows PowerShell.

## Prerequisites

- Azure CLI installed and logged in.
- Bicep CLI available through Azure CLI.
- `gh` CLI installed and authenticated if you want to set GitHub repository variables.
- Azure subscription permissions to create resource groups, identities, role assignments, AI resources, Container Apps, PostgreSQL, and ACR.
- Existing deployments do not require local data-plane access to Key Vault for bootstrap secrets. When a vault already exists, the script reuses Container App Key Vault references and does not read or rotate those secrets locally.

## What-if

First, preflight candidate regions with the exact deployment template:

```powershell
.\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass
```

This catches subscription/region restrictions and live capacity issues that static provider-location checks cannot prove.
See `deployment-lessons-learned.md` for known region, model, ACR build, and Container Apps issues found during the first deployment.

```powershell
az login
az account set --subscription "<subscription-id-or-name>"
.\infra\azure\scripts\deploy.ps1 -WhatIf
```

## Deploy infrastructure

```powershell
.\infra\azure\scripts\deploy.ps1
```

For the public CD target, use the `public` environment name without a `test` suffix:

```powershell
.\infra\azure\scripts\deploy.ps1 `
  -ResourceGroupName "ai-coach-public-rg" `
  -EnvironmentName "public" `
  -NetworkProfile publicDemo `
  -Location eastasia `
  -FoundryLocation SwedenCentral `
  -ChatDeploymentCapacity 30
```

The script:

1. Reuses existing Key Vault secrets when the target resource group already has a vault.
2. Prompts/generates secrets only for a first deployment.
3. Deploys `main.bicep` at subscription scope.
4. Prints GitHub OIDC values.

Generated secret parameter files live in `infra\azure\.local\` and are ignored by git. By default, the generated parameter file is removed after deployment.

The default mode is infrastructure-only. It does not rebuild images or update Container App revisions.
For existing deployments, the script reads the current backend/frontend Container App images and passes them back into Bicep so infra-only runs do not revert the apps to the placeholder image.

For private backend infrastructure, pass `-NetworkProfile privateBackend`. You can provide an existing VNet with `-VnetName`; otherwise the template creates one using the configured CIDR parameters. This profile keeps frontend public, makes backend ingress internal, and adds private endpoint DNS for Storage, Key Vault, PostgreSQL, and Foundry.

Recommended private network test environment:

```powershell
.\infra\azure\scripts\deploy.ps1 `
  -ResourceGroupName "ai-coach-private-rg" `
  -EnvironmentName "private" `
  -NetworkProfile privateBackend `
  -Location eastasia `
  -FoundryLocation eastus2 `
  -ChatDeploymentSkuName GlobalStandard `
  -ChatDeploymentCapacity 120
```

## Deploy infrastructure and app images

```powershell
.\infra\azure\scripts\deploy.ps1 -DeployApp
```

Use `-DeployApp` when you intentionally want to build backend/frontend images with ACR Tasks and update Container Apps after the infrastructure deployment.

Run this command from the branch/worktree that contains the application code you want to test. ACR builds from the local `backend\` and `frontend\` folders; it does not automatically combine other local branches. To cloud-test the PostgreSQL, Blob Storage, Rubric, and Voice fixes together, first check out or create an integration branch that contains all of those commits.

The ACR builds use deployment-only Dockerfiles under `infra\azure\docker\`. The backend Dockerfile installs the PostgreSQL and Voice extras required by the deployed PostgreSQL `DATABASE_URL` and Voice Live runtime path. The frontend Dockerfile uses public `node:20-slim` and `nginx:alpine` base images because the MCR mirror does not currently publish `node:20-slim`.

The Bicep template already configures the backend Container App for Azure Blob Storage in cloud:

| Setting | Cloud value |
|---|---|
| `STORAGE_BACKEND` | `azure_blob` |
| `AZURE_STORAGE_ACCOUNT_URL` | Storage account blob endpoint from Bicep |
| `AZURE_STORAGE_CONTAINER_NAME` | `materials` |
| Managed identity RBAC | `Storage Blob Data Contributor` |

Local development is not affected by these cloud settings. Without the cloud env vars, the app keeps its local storage default.

The template does not set `SEED_DATA_IGNORE=true`. Startup sample/demo seed behavior therefore remains controlled by the application default and any explicit Container App env override you add later.

## Verify existing endpoints

```powershell
.\infra\azure\scripts\deploy.ps1 -Verify
```

Verification is opt-in. `-DeployApp` does not automatically run verification. For `privateBackend`, the backend URL is internal and cannot be checked directly from a local workstation unless you have a private network path; use `-Verify` only for reachable endpoints or run private checks from inside the VNet/Container Apps environment.

## Realtime quota allocation

The deployment defaults to `realtimeDeploymentCapacity = 5` so the existing standalone OpenAI `gpt-realtime-1.5` deployment and the Foundry deployment can share a 10 RPM quota pool as 5 RPM + 5 RPM. Override it only after checking the quota page for the selected region/model/SKU.

## Legacy image-skip switch

```powershell
.\infra\azure\scripts\deploy.ps1 -SkipImageBuild
```

`-SkipImageBuild` is kept for compatibility. The script already skips app image builds unless `-DeployApp` is passed.

## Build and update images later

Use the output values from `infra\azure\.local\deployment.outputs.json`:

```powershell
.\infra\azure\scripts\build-and-push.ps1 `
  -ResourceGroupName "<resource-group>" `
  -ContainerRegistryName "<acr-name>" `
  -BackendContainerAppName "<backend-app-name>" `
  -FrontendContainerAppName "<frontend-app-name>" `
  -BackendUrl "<backend-url>"
```

Like `deploy.ps1 -DeployApp`, this builds the current local `backend\` and `frontend\` directories. Make sure the desired application branch is checked out before running it.

## Set GitHub repository variables

After deployment, use the printed values:

```powershell
.\infra\azure\scripts\set-github-vars.ps1 `
  -Repository "huqianghui/AI-avatar-vibe-coding" `
  -AzureClientId "<AZURE_CLIENT_ID>" `
  -AzureTenantId "<AZURE_TENANT_ID>" `
  -AzureSubscriptionId "<AZURE_SUBSCRIPTION_ID>" `
  -ResourceGroupName "<AZURE_RESOURCE_GROUP>" `
  -AcrName "<ACR_NAME>" `
  -BackendAppName "<BACKEND_APP_NAME>" `
  -FrontendAppName "<FRONTEND_APP_NAME>" `
  -BackendBootstrapJobName "<BACKEND_BOOTSTRAP_JOB_NAME>"
```

For the private test environment, write variables to the GitHub Environment instead of overwriting repository-level public variables:

```powershell
.\infra\azure\scripts\set-github-vars.ps1 `
  -Repository "huqianghui/AI-avatar-vibe-coding" `
  -EnvironmentName "private" `
  -AzureClientId "<AZURE_CLIENT_ID>" `
  -AzureTenantId "<AZURE_TENANT_ID>" `
  -AzureSubscriptionId "<AZURE_SUBSCRIPTION_ID>" `
  -ResourceGroupName "<AZURE_RESOURCE_GROUP>" `
  -AcrName "<ACR_NAME>" `
  -BackendAppName "<BACKEND_APP_NAME>" `
  -FrontendAppName "<FRONTEND_APP_NAME>" `
  -BackendBootstrapJobName "<BACKEND_BOOTSTRAP_JOB_NAME>"
```

This sets repository variables only. It does not modify the existing workflow file.

## Verify an existing deployment

```powershell
.\infra\azure\scripts\verify-deployment.ps1 `
  -BackendUrl "<backend-url>" `
  -FrontendUrl "<frontend-url>"
```

## Teardown

The deployment creates one resource group by default. To remove Demo/PoC resources:

```powershell
az group delete --name "rg-aicoach-demo-swedencentral"
```

Confirm the actual resource group name before deletion.
