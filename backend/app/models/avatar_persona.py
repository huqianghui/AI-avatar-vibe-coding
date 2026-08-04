"""AvatarPersona ORM model (Phase 36, PERSONA-01/02; Phase 37, PERSONA-07/HARD-01).

Admin-managed catalog of digital-human personas: an Azure prebuilt avatar
character + style, a per-language voice map, a per-language greeting map, and
a persona prompt fragment. Exactly one enabled persona is ever flagged
`is_default` -- enforced in the service layer AND, as of Phase 37, by a
partial unique DB index (`ix_avatar_personas_unique_default`) that rejects a
second enabled default even if the service-layer guard is bypassed."""

from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AvatarPersona(Base, TimestampMixin):
    """A selectable digital-human persona (character/style/voice/prompt)."""

    __tablename__ = "avatar_personas"
    __table_args__ = (
        Index(
            "ix_avatar_personas_unique_default",
            "is_default",
            unique=True,
            sqlite_where=text("enabled = 1 AND is_default = 1"),
            postgresql_where=text("enabled = true AND is_default = true"),
        ),
    )

    name: Mapped[str] = mapped_column(String(100))
    character: Mapped[str] = mapped_column(String(100))
    style: Mapped[str] = mapped_column(String(100), default="")
    # JSON map, e.g. {"zh-CN": "...", "en-US": "..."}
    voice_map: Mapped[str] = mapped_column(Text, default="{}")
    # JSON map, e.g. {"zh-CN": "...", "en-US": "..."} (Phase 37, PERSONA-07)
    greeting_map: Mapped[str] = mapped_column(Text, default="{}")
    prompt_fragment: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI Foundry Agent sync fields (persona-hcp-foundry-alignment Increment A) --
    # mirrors HcpProfile.agent_id/agent_version/agent_sync_status/agent_sync_error
    # (backend/app/models/hcp_profile.py) so personas can be synced to real
    # Foundry prompt agents the same way HCP profiles are, via the already
    # provider-agnostic agent_sync_service.sync_agent_for_profile().
    agent_id: Mapped[str] = mapped_column(String(100), default="")
    agent_version: Mapped[str] = mapped_column(String(50), default="")
    agent_sync_status: Mapped[str] = mapped_column(
        String(20), default="none"
    )  # none|pending|synced|failed
    agent_sync_error: Mapped[str] = mapped_column(Text, default="")

    # Knowledge Base / Foundry IQ configs (persona-hcp-foundry-alignment
    # Increment C) -- mirrors HcpProfile.knowledge_configs, sibling table
    # AvatarPersonaKnowledgeConfig (not a shared polymorphic FK).
    knowledge_configs = relationship(
        "AvatarPersonaKnowledgeConfig",
        back_populates="avatar_persona",
        cascade="all, delete-orphan",
    )

    @property
    def knowledge_config_count(self) -> int:
        """Count of associated knowledge base configs (mirrors HcpProfile)."""
        try:
            return len(self.knowledge_configs)
        except Exception:
            return 0

    def to_prompt_dict(self) -> dict:
        """Return persona data as a dict for agent_sync_service.build_agent_instructions().

        Personas have no HCP-style personality/knowledge fields to generate
        instructions FROM -- prompt_fragment IS the persona's full instructions
        text, so it is surfaced as `agent_instructions_override`, which
        build_agent_instructions() checks first (before any template) and
        returns verbatim when non-empty.
        """
        return {
            "name": self.name,
            "agent_instructions_override": self.prompt_fragment,
        }
