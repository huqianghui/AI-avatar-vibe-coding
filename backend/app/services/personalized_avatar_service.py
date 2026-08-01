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
from app.services.agent_chat_service import stream_agent_response
from app.services.avatar_search_service import retrieve_citations
from app.services.avatar_service import REFUSAL_TEMPLATES
from app.services.personalization_injection_service import build_personalization_context


async def handle_personalized_turn(
    db: AsyncSession,
    session: PersonalizedAvatarSession,
    user: User,
    message: str,
    public_config: PublicKnowledgeConfig,
    locale: str = "zh-CN",
) -> dict:
    """Run one personalized Q&A turn: concurrent agent-chat (with the built
    personalization context prepended) + citation retrieval, refusal gating,
    and a single audit-log write tagged with user_id/personalized_session_id."""
    personalization_context = await build_personalization_context(db, user.id)

    async def collect_agent_text() -> tuple[str, str | None]:
        chunks: list[str] = []
        response_id: str | None = None
        async for event in stream_agent_response(
            db,
            public_config.agent_id,
            public_config.agent_version,
            message,
            session.last_response_id or None,
            personalization_context=personalization_context,
        ):
            if event.kind == "text":
                chunks.append(event.text)
            elif event.kind == "completed":
                response_id = event.response_id
        return "".join(chunks), response_id

    try:
        (answer_text, response_id), citations = await asyncio.gather(
            collect_agent_text(),
            retrieve_citations(public_config.connection_target, public_config.index_name, message),
        )
    except Exception:
        answer_text, response_id, citations = "", None, []

    is_refusal = len(citations) == 0
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
