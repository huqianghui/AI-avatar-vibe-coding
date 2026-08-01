"""Public Knowledge Config ORM model (anonymous avatar admin config)."""

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PublicKnowledgeConfig(Base, TimestampMixin):
    """Singleton (service-layer enforced, one active row) config for the anonymous
    public avatar: which hosted Prompt Agent + Foundry IQ knowledge base + avatar/voice
    per language it uses. Admin-managed per CONTEXT.md — never env-var hardcoded."""

    __tablename__ = "public_knowledge_configs"

    agent_id: Mapped[str] = mapped_column(String(100), default="")
    agent_version: Mapped[str] = mapped_column(String(50), default="")
    connection_name: Mapped[str] = mapped_column(String(255), default="")
    connection_target: Mapped[str] = mapped_column(String(500), default="")
    index_name: Mapped[str] = mapped_column(String(255), default="")
    avatar_character: Mapped[str] = mapped_column(String(100), default="lori")
    avatar_style: Mapped[str] = mapped_column(String(100), default="casual")
    # JSON map, e.g. {"zh-CN": "...", "en-US": "..."}
    voice_map: Mapped[str] = mapped_column(Text, default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
