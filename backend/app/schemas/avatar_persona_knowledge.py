"""AvatarPersona Knowledge Base configuration schemas
(persona-hcp-foundry-alignment Increment C).

`KnowledgeConfigCreate` from `app.schemas.knowledge_base` is reused as-is for
the create request body (same 3 fields, no persona-specific data needed)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PersonaKnowledgeConfigOut(BaseModel):
    """Read-only representation of an AvatarPersona knowledge config row."""

    id: str
    avatar_persona_id: str
    connection_name: str
    connection_target: str
    index_name: str
    server_label: str
    is_enabled: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
