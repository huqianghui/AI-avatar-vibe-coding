"""AvatarPersona ORM model (Phase 36, PERSONA-01/02; Phase 37, PERSONA-07/HARD-01).

Admin-managed catalog of digital-human personas: an Azure prebuilt avatar
character + style, a per-language voice map, a per-language greeting map, and
a persona prompt fragment. Exactly one enabled persona is ever flagged
`is_default` -- enforced in the service layer AND, as of Phase 37, by a
partial unique DB index (`ix_avatar_personas_unique_default`) that rejects a
second enabled default even if the service-layer guard is bypassed."""

from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

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
