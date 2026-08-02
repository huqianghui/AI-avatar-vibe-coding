"""AvatarPersona ORM model (Phase 36, PERSONA-01/02).

Admin-managed catalog of digital-human personas: an Azure prebuilt avatar
character + style, a per-language voice map, a greeting, and a persona
prompt fragment. Exactly one enabled persona is ever flagged `is_default`
(enforced in the service layer, not the DB schema)."""

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AvatarPersona(Base, TimestampMixin):
    """A selectable digital-human persona (character/style/voice/prompt)."""

    __tablename__ = "avatar_personas"

    name: Mapped[str] = mapped_column(String(100))
    character: Mapped[str] = mapped_column(String(100))
    style: Mapped[str] = mapped_column(String(100), default="")
    # JSON map, e.g. {"zh-CN": "...", "en-US": "..."}
    voice_map: Mapped[str] = mapped_column(Text, default="{}")
    greeting: Mapped[str] = mapped_column(Text, default="")
    prompt_fragment: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
