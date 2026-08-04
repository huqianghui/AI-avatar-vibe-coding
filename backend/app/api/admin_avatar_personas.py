"""Admin API for AvatarPersona CRUD management (Phase 36, PERSONA-01/02).

All routes are admin-only (T-36-02). The unique-default guard (D-02) is
enforced in the service layer -- `ConflictException` propagates through the
global exception handler as a natural 409, not caught here."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.avatar_persona import AvatarPersonaCreate, AvatarPersonaOut, AvatarPersonaUpdate
from app.schemas.avatar_persona_knowledge import PersonaKnowledgeConfigOut
from app.schemas.knowledge_base import KnowledgeConfigCreate
from app.services import avatar_persona_service, persona_knowledge_service
from app.utils.exceptions import bad_request

router = APIRouter(prefix="/admin/avatar-personas", tags=["admin-avatar-personas"])


class AgentPortalUrlResponse(BaseModel):
    """Azure Portal URL for viewing a persona's agent in the playground
    (persona-hcp-foundry-alignment Increment A; mirrors hcp_profiles.py's
    AgentPortalUrlResponse)."""

    url: str
    agent_name: str
    agent_version: str


@router.get("", response_model=list[AvatarPersonaOut])
async def list_personas(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> list[AvatarPersonaOut]:
    """List all AvatarPersona rows (enabled and disabled). Admin only."""
    personas = await avatar_persona_service.list_personas(db, enabled_only=False)
    return [AvatarPersonaOut.model_validate(p) for p in personas]


@router.post("", response_model=AvatarPersonaOut, status_code=201)
async def create_persona(
    data: AvatarPersonaCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Create a new AvatarPersona. Admin only."""
    persona = await avatar_persona_service.create_persona(db, data)
    return AvatarPersonaOut.model_validate(persona)


@router.get("/{persona_id}", response_model=AvatarPersonaOut)
async def get_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Get a single AvatarPersona by ID. Admin only."""
    persona = await avatar_persona_service.get_persona(db, persona_id)
    return AvatarPersonaOut.model_validate(persona)


@router.put("/{persona_id}", response_model=AvatarPersonaOut)
async def update_persona(
    persona_id: str,
    data: AvatarPersonaUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Update an AvatarPersona. Admin only.

    Disabling the current default persona requires `new_default_persona_id`
    in the body to atomically promote a replacement first (409 otherwise)."""
    persona = await avatar_persona_service.update_persona(db, persona_id, data)
    return AvatarPersonaOut.model_validate(persona)


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(
    persona_id: str,
    new_default_persona_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> Response:
    """Delete an AvatarPersona. Admin only.

    Deleting the current default persona requires `?new_default_persona_id=`
    to atomically promote a replacement first (409 otherwise)."""
    await avatar_persona_service.delete_persona(
        db, persona_id, new_default_persona_id=new_default_persona_id
    )
    return Response(status_code=204)


@router.post("/{persona_id}/set-default", response_model=AvatarPersonaOut)
async def set_default_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Promote a persona to be the sole default. Admin only."""
    persona = await avatar_persona_service.set_default_persona(db, persona_id)
    return AvatarPersonaOut.model_validate(persona)


@router.post("/{persona_id}/retry-sync", response_model=AvatarPersonaOut)
async def retry_sync(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AvatarPersonaOut:
    """Retry AI Foundry agent sync for a persona with failed status. Admin only.

    (persona-hcp-foundry-alignment Increment A; mirrors hcp_profiles.py's
    /{profile_id}/retry-sync route.)"""
    persona = await avatar_persona_service.retry_agent_sync(db, persona_id)
    return AvatarPersonaOut.model_validate(persona)


@router.get("/{persona_id}/agent-portal-url", response_model=AgentPortalUrlResponse)
async def get_agent_portal_url(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> AgentPortalUrlResponse:
    """Get the Azure Portal URL for viewing this persona's agent in the
    playground. Admin only.

    (persona-hcp-foundry-alignment Increment A; mirrors hcp_profiles.py's
    /{profile_id}/portal-url route.) Auto-discovers subscription, resource
    group, resource name from the connections API -- no extra env vars
    needed beyond endpoint + key."""
    from app.services import agent_sync_service

    persona = await avatar_persona_service.get_persona(db, persona_id)
    if not persona.agent_id:
        bad_request("No agent synced for this persona.")

    components = await agent_sync_service.get_portal_url_components(db)
    sub_hash = components.get("subscription_hash", "")
    rg = components.get("resource_group", "")
    resource_name = components.get("resource_name", "")
    project_name = components.get("project_name", "")

    # Always fetch latest version from Azure (version increments on each update)
    version = await agent_sync_service.get_agent_latest_version(db, persona.agent_id)
    if sub_hash and rg and resource_name and project_name:
        url = (
            f"https://ai.azure.com/nextgen/r/"
            f"{sub_hash},{rg},,{resource_name},{project_name}"
            f"/build/agents/{persona.agent_id}/build?version={version}"
        )
    else:
        # Fallback: generic Azure AI Studio URL
        url = "https://ai.azure.com"

    return AgentPortalUrlResponse(
        url=url,
        agent_name=persona.agent_id,
        agent_version=version,
    )


@router.get("/{persona_id}/knowledge-configs", response_model=list[PersonaKnowledgeConfigOut])
async def get_persona_knowledge_configs(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> list[PersonaKnowledgeConfigOut]:
    """List Knowledge Base configs attached to a persona's AI Foundry Agent.
    Admin only.

    (persona-hcp-foundry-alignment Increment C; mirrors knowledge_base.py's
    GET /knowledge-base/hcp/{hcp_profile_id}/configs route.)"""
    configs = await persona_knowledge_service.get_knowledge_configs(db, persona_id)
    return [PersonaKnowledgeConfigOut.model_validate(c) for c in configs]


@router.post(
    "/{persona_id}/knowledge-configs",
    response_model=PersonaKnowledgeConfigOut,
    status_code=201,
)
async def add_persona_knowledge_config(
    persona_id: str,
    data: KnowledgeConfigCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> PersonaKnowledgeConfigOut:
    """Attach a Knowledge Base to a persona's AI Foundry Agent. Admin only.

    (persona-hcp-foundry-alignment Increment C; mirrors knowledge_base.py's
    POST /knowledge-base/hcp/{hcp_profile_id}/configs route.)"""
    config = await persona_knowledge_service.add_knowledge_config(db, persona_id, data)
    return PersonaKnowledgeConfigOut.model_validate(config)


@router.delete("/knowledge-configs/{config_id}", status_code=204)
async def remove_persona_knowledge_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> Response:
    """Remove a Knowledge Base config from a persona. Admin only.

    (persona-hcp-foundry-alignment Increment C; mirrors knowledge_base.py's
    DELETE /knowledge-base/configs/{config_id} route.)"""
    await persona_knowledge_service.remove_knowledge_config(db, config_id)
    return Response(status_code=204)
