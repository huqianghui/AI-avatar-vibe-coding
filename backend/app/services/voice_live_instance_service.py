"""Voice Live Instance CRUD service.

Manages reusable Voice Live configuration instances that can be assigned to
HCP Profiles (legacy/display purposes only as of VMODE-01). Provides config
resolution via resolve_voice_config() -- since VMODE-01 (2026-08-04 rescope),
this reads exclusively from HcpProfile's own inline voice-mode columns
(restored by the g40a migration), not from profile.voice_live_instance.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.hcp_profile import HcpProfile
from app.models.voice_live_instance import VoiceLiveInstance
from app.schemas.voice_live_instance import (
    VoiceLiveInstanceCreate,
    VoiceLiveInstanceUpdate,
)
from app.utils.exceptions import NotFoundException

logger = logging.getLogger(__name__)


async def create_instance(
    db: AsyncSession,
    data: VoiceLiveInstanceCreate,
    user_id: str,
) -> VoiceLiveInstance:
    """Create a new Voice Live configuration instance."""
    instance_data = data.model_dump()
    instance_data["created_by"] = user_id
    instance = VoiceLiveInstance(**instance_data)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    logger.info("VL instance created: id=%s, name=%s", instance.id, instance.name)
    # Re-query with selectinload so hcp_profiles is available in async context
    return await get_instance(db, instance.id)


async def get_instance(db: AsyncSession, instance_id: str) -> VoiceLiveInstance:
    """Get a Voice Live Instance by ID. Raises NotFoundException if not found."""
    result = await db.execute(
        select(VoiceLiveInstance)
        .options(selectinload(VoiceLiveInstance.hcp_profiles))
        .where(VoiceLiveInstance.id == instance_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise NotFoundException(message=f"Voice Live Instance {instance_id} not found")
    return instance


async def list_instances(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[VoiceLiveInstance], int]:
    """List all Voice Live Instances with pagination. Returns (items, total)."""
    # Count
    count_q = select(func.count()).select_from(VoiceLiveInstance)
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch with eager-loaded hcp_profiles for hcp_count
    offset = (page - 1) * page_size
    query = (
        select(VoiceLiveInstance)
        .options(selectinload(VoiceLiveInstance.hcp_profiles))
        .order_by(VoiceLiveInstance.updated_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_instance(
    db: AsyncSession,
    instance_id: str,
    data: VoiceLiveInstanceUpdate,
) -> VoiceLiveInstance:
    """Update a Voice Live Instance. Raises NotFoundException if not found."""
    instance = await get_instance(db, instance_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(instance, key, value)
    await db.commit()
    await db.refresh(instance)
    logger.info(
        "VL instance updated: id=%s, fields=%s",
        instance_id,
        list(update_data.keys()),
    )

    # Re-sync all assigned HCPs that have synced agents.
    # TODO: If HCP-per-instance count grows significantly, consider moving to
    # async background task (per owner decision RD-3).
    from app.services.agent_sync_service import (
        build_voice_live_metadata,
        update_agent_metadata_only,
    )

    refreshed = await get_instance(db, instance.id)
    if refreshed.hcp_profiles:
        for profile in refreshed.hcp_profiles:
            if profile.agent_id and profile.agent_sync_status == "synced":
                try:
                    # Set relationship directly to avoid async lazy-load
                    # (profile was loaded via selectinload on VoiceLiveInstance,
                    #  but its own voice_live_instance back-ref is not loaded)
                    profile.voice_live_instance = refreshed
                    vl_metadata = build_voice_live_metadata(profile)
                    if vl_metadata:
                        new_version = await update_agent_metadata_only(
                            db, profile.agent_id, vl_metadata
                        )
                        # Use Foundry-returned version as authoritative source
                        if new_version:
                            profile.agent_version = new_version
                except Exception as e:
                    logger.warning(
                        "update_instance: re-sync failed for hcp=%s agent=%s: %s",
                        profile.id,
                        profile.agent_id,
                        e,
                    )
        await db.flush()

    return refreshed


async def delete_instance(db: AsyncSession, instance_id: str) -> None:
    """Delete a Voice Live Instance. Auto-unassigns HCPs before deleting."""
    instance = await get_instance(db, instance_id)

    # Auto-unassign all HCP profiles referencing this instance
    # and clear agent metadata for each HCP with a synced agent
    if instance.hcp_profiles:
        from app.services.agent_sync_service import (
            build_cleared_voice_metadata,
            update_agent_metadata_only,
        )

        for profile in instance.hcp_profiles:
            if profile.agent_id and profile.agent_sync_status == "synced":
                try:
                    cleared = build_cleared_voice_metadata()
                    new_version = await update_agent_metadata_only(db, profile.agent_id, cleared)
                    # Use Foundry-returned version as authoritative source
                    if new_version:
                        profile.agent_version = new_version
                except Exception as e:
                    logger.warning(
                        "delete_instance: failed to clear agent metadata for hcp=%s: %s",
                        profile.id,
                        e,
                    )
            profile.voice_live_instance_id = None
        await db.flush()

    await db.delete(instance)
    await db.commit()
    logger.info("VL instance deleted: id=%s", instance_id)


async def assign_to_hcp(
    db: AsyncSession,
    instance_id: str,
    hcp_profile_id: str,
) -> HcpProfile:
    """Assign a Voice Live Instance to an HCP Profile."""
    # Load the instance (also verifies it exists)
    instance = await get_instance(db, instance_id)

    # Load HCP profile
    result = await db.execute(select(HcpProfile).where(HcpProfile.id == hcp_profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException(message=f"HCP Profile {hcp_profile_id} not found")

    profile.voice_live_instance_id = instance_id
    await db.commit()
    await db.refresh(profile)
    # Set relationship directly so resolve_voice_config works in async context
    profile.voice_live_instance = instance
    logger.info("VL instance assigned: instance=%s, hcp=%s", instance_id, hcp_profile_id)

    # Trigger agent metadata sync for the assigned HCP
    if profile.agent_id and profile.agent_sync_status == "synced":
        try:
            from app.services.agent_sync_service import (
                build_voice_live_metadata,
                update_agent_metadata_only,
            )

            vl_metadata = build_voice_live_metadata(profile)
            if vl_metadata:
                new_version = await update_agent_metadata_only(db, profile.agent_id, vl_metadata)
                # Use Foundry-returned version as authoritative source
                if new_version:
                    profile.agent_version = new_version
                    await db.flush()
        except Exception as e:
            logger.warning(
                "assign_to_hcp: agent metadata sync failed for hcp=%s: %s",
                hcp_profile_id,
                e,
            )

    # Expire cached instance so subsequent get_instance fetches fresh hcp_profiles
    db.expire_all()
    return profile


async def unassign_from_hcp(db: AsyncSession, hcp_profile_id: str) -> HcpProfile:
    """Remove Voice Live Instance association from an HCP Profile."""
    result = await db.execute(select(HcpProfile).where(HcpProfile.id == hcp_profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException(message=f"HCP Profile {hcp_profile_id} not found")

    # Capture agent info before clearing instance (needed for metadata clear)
    had_agent = profile.agent_id and profile.agent_sync_status == "synced"

    profile.voice_live_instance_id = None
    await db.commit()
    await db.refresh(profile)
    logger.info("VL instance unassigned: hcp=%s", hcp_profile_id)

    # Clear agent voice metadata on unassign (RD-4)
    if had_agent:
        try:
            from app.services.agent_sync_service import (
                build_cleared_voice_metadata,
                update_agent_metadata_only,
            )

            cleared = build_cleared_voice_metadata()
            new_version = await update_agent_metadata_only(db, profile.agent_id, cleared)
            # Use Foundry-returned version as authoritative source
            if new_version:
                profile.agent_version = new_version
                await db.flush()
        except Exception as e:
            logger.warning(
                "unassign_from_hcp: failed to clear agent metadata for hcp=%s: %s",
                hcp_profile_id,
                e,
            )

    return profile


def resolve_voice_config(profile: HcpProfile) -> dict:
    """Resolve voice/avatar config for an HCP Profile.

    VMODE-01 (2026-08-04 rescope): sources voice_live_model/voice_name/
    avatar_character/avatar_style/avatar_enabled/recognition_language directly
    from HcpProfile's own inline columns -- these are now the sole source of
    truth, mirroring the AI Foundry portal's direct-config style. This
    function no longer reads profile.voice_live_instance at all; the FK
    (voice_live_instance_id) is vestigial, retained only for legacy/display
    purposes. Falls back to each column's own model default only if the
    inline value is somehow empty/None.

    The remaining keys in the returned dict are not exposed in the UI for
    this phase and are hardcoded to fixed values matching the retired
    VoiceLiveInstance defaults.
    """
    logger.debug(
        "resolve_voice_config: hcp=%s source=inline HcpProfile columns (VMODE-01)",
        profile.id,
    )
    return {
        "voice_live_enabled": True,
        "voice_live_model": profile.voice_live_model or "gpt-4o",
        "voice_name": profile.voice_name or "en-US-AvaNeural",
        "voice_type": "azure-standard",
        "voice_temperature": 0.9,
        "voice_custom": False,
        "avatar_character": profile.avatar_character or "lisa",
        "avatar_style": profile.avatar_style or "casual",
        "avatar_customized": False,
        "turn_detection_type": "server_vad",
        "noise_suppression": False,
        "echo_cancellation": False,
        "eou_detection": False,
        "recognition_language": profile.recognition_language or "auto",
        "model_instruction": "",
        "response_temperature": 0.8,
        "proactive_engagement": True,
        "auto_detect_language": True,
        "playback_speed": 1.0,
        "custom_lexicon_enabled": False,
        "custom_lexicon_url": "",
        "avatar_enabled": bool(profile.avatar_enabled),
    }
