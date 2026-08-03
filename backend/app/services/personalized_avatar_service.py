"""Personalized authenticated avatar Q&A orchestrator (Phase 33, PERS-02,
D-05/D-08/D-15).

Mirrors handle_anonymous_turn (avatar_service.py) exactly for the
agent-stream + citation-retrieval + refusal-gating + audit-log shape, but:
- injects a sanitized "用户背景" context via build_personalization_context()
  as a `developer`-role message ahead of the user's turn (D-05), never
  editing the agent's own configured instructions;
- writes AvatarInteractionLog.user_id/personalized_session_id instead of
  session_id/ip_address -- personalized turns are traceable to a user, not
  an IP (AI Avatar Domain Rule 7)."""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.personalized_avatar_session import PersonalizedAvatarSession
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.models.user import User
from app.services.agent_chat_service import stream_agent_response, stream_model_response
from app.services.avatar_persona_service import resolve_active_persona
from app.services.avatar_search_service import retrieve_citations
from app.services.avatar_service import REFUSAL_TEMPLATES
from app.services.personalization_injection_service import build_personalization_context
from app.services.personalization_sanitizer import sanitize_free_text_with_pii


async def handle_personalized_turn(
    db: AsyncSession,
    session: PersonalizedAvatarSession,
    user: User,
    message: str,
    public_config: PublicKnowledgeConfig | None,
    locale: str = "zh-CN",
) -> dict:
    """Run one personalized Q&A turn: concurrent agent-chat (with the built
    personalization context prepended) + citation retrieval, refusal gating,
    and a single audit-log write tagged with user_id/personalized_session_id.

    Phase 36 (PERSONA-04): the user's active persona fragment (re-sanitized,
    gate 2) is concatenated ahead of their existing CRM/preference context --
    the CRM sanitization pipeline itself is untouched, only concatenated
    with.

    Foundry IQ is OPTIONAL: with no active `PublicKnowledgeConfig` (or one
    without an agent_id) the turn degrades to a plain-model ungrounded answer
    -- no citations, and no citation-based refusal gating (mirrors
    `handle_anonymous_turn`)."""
    grounded = bool(public_config and (public_config.agent_id or "").strip())
    persona = await resolve_active_persona(db, user_id=user.id, requested_persona_id=None)
    sanitized_persona_fragment = sanitize_free_text_with_pii(persona.prompt_fragment)
    crm_context = await build_personalization_context(db, user.id)
    personalization_context = "\n\n".join(filter(None, [sanitized_persona_fragment, crm_context]))

    async def collect_answer_text() -> tuple[str, str | None]:
        chunks: list[str] = []
        response_id: str | None = None
        if grounded:
            assert public_config is not None
            stream = stream_agent_response(
                db,
                public_config.agent_id,
                public_config.agent_version,
                message,
                session.last_response_id or None,
                personalization_context=personalization_context,
            )
        else:
            stream = stream_model_response(
                db,
                message,
                session.last_response_id or None,
                personalization_context=personalization_context,
            )
        async for event in stream:
            if event.kind == "text":
                chunks.append(event.text)
            elif event.kind == "completed":
                response_id = event.response_id
        return "".join(chunks), response_id

    failed = False
    try:
        if grounded:
            assert public_config is not None
            (answer_text, response_id), citations = await asyncio.gather(
                collect_answer_text(),
                retrieve_citations(
                    public_config.connection_target, public_config.index_name, message
                ),
            )
        else:
            answer_text, response_id = await collect_answer_text()
            citations = []
    except Exception:
        answer_text, response_id, citations = "", None, []
        failed = True

    is_refusal = failed or (grounded and len(citations) == 0)
    final_answer = (
        REFUSAL_TEMPLATES.get(locale, REFUSAL_TEMPLATES["zh-CN"]) if is_refusal else answer_text
    )

    session.last_response_id = response_id or session.last_response_id
    db.add(
        AvatarInteractionLog(
            user_id=user.id,
            personalized_session_id=session.id,
            question=message,
            answer_summary=final_answer[:2000],
            citation_count=len(citations),
            is_refusal=is_refusal,
            response_id=response_id or "",
        )
    )
    await db.commit()

    return {
        "answer": final_answer,
        "citations": citations,
        "is_refusal": is_refusal,
        "response_id": response_id or "",
    }
