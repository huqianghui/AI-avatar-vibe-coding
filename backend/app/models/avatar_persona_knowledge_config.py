"""AvatarPersona Knowledge Base configuration ORM model
(persona-hcp-foundry-alignment Increment C).

Sibling table to HcpKnowledgeConfig (backend/app/models/hcp_knowledge_config.py)
rather than a shared polymorphic FK -- HcpKnowledgeConfig.hcp_profile_id is a
hard-typed, NOT-NULL `ForeignKey("hcp_profiles.id", ondelete="CASCADE")`, so
duplicating the table avoids any risk to that existing FK/CASCADE semantics
(see debug session persona-hcp-foundry-alignment.md, Evidence)."""

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AvatarPersonaKnowledgeConfig(Base, TimestampMixin):
    """Knowledge base connection configuration for an AvatarPersona's AI Foundry Agent."""

    __tablename__ = "avatar_persona_knowledge_configs"

    avatar_persona_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("avatar_personas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_name: Mapped[str] = mapped_column(String(255), nullable=False)
    connection_target: Mapped[str] = mapped_column(String(500), default="")
    index_name: Mapped[str] = mapped_column(String(255), nullable=False)
    server_label: Mapped[str] = mapped_column(String(255), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationship
    avatar_persona = relationship("AvatarPersona", back_populates="knowledge_configs")
