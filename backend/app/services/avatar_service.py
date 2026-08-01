"""Anonymous grounded avatar Q&A orchestrator (Phase 32, ANON-02/ANON-03/ANON-05).

Runs the existing Agent chat stream (spoken/text answer) concurrently with a
direct AI Search `retrieve` call (structured citations), gates on the
refusal design decision described below, and writes exactly one audit log
row per turn (T-32-08).

Design decision — refusal threshold: zero full-field citations from
`retrieve_citations()` (a search no-hit), NOT a relevance-score cutoff.
Score-field availability on the live knowledge source is unverified
(32-RESEARCH.md Pitfall 1); zero-hit is the safer, zero-fabrication-risk
interpretation of the locked "strict full-field citation" + "no-match
refusal" decisions (T-32-07: fabricated/incomplete citations must never be
shown as authoritative).

No client-suppliable `agent_id`/`kb_name` field exists in this path (T-32-05)
— `public_config` is always the server-resolved single active
`PublicKnowledgeConfig` row, never anything from the request body.
"""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.anonymous_avatar_session import AnonymousAvatarSession
from app.models.avatar_interaction_log import AvatarInteractionLog
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.agent_chat_service import stream_agent_response
from app.services.avatar_search_service import retrieve_citations

REFUSAL_TEMPLATES = {
    "zh-CN": "抱歉，我目前只能回答与官网内容相关的问题。",
    "en-US": (
        "Sorry, I can currently only answer questions related to the official website content."
    ),
}


async def handle_anonymous_turn(
    db: AsyncSession,
    session: AnonymousAvatarSession,
    message: str,
    public_config: PublicKnowledgeConfig,
    locale: str = "zh-CN",
) -> dict:
    """Run one anonymous Q&A turn: concurrent agent-chat + citation retrieval,
    refusal gating, and a single audit-log write."""

    async def collect_agent_text() -> tuple[str, str | None]:
        chunks: list[str] = []
        response_id: str | None = None
        async for event in stream_agent_response(
            db,
            public_config.agent_id,
            public_config.agent_version,
            message,
            session.last_response_id or None,
        ):
            if event.kind == "text":
                chunks.append(event.text)
            elif event.kind == "completed":
                response_id = event.response_id
        return "".join(chunks), response_id

    try:
        (answer_text, response_id), citations = await asyncio.gather(
            collect_agent_text(),
            retrieve_citations(
                public_config.connection_target, public_config.index_name, message
            ),
        )
    except Exception:
        # Agent stream or citation retrieval failed -- degrade to the fixed
        # refusal response instead of propagating and silently dropping the
        # audit-log write below. ANON-05 / T-32-08 require every anonymous
        # turn to be auditable, and a half-formed/unfiltered answer must
        # never reach the visitor as if it were grounded (T-32-07).
        answer_text, response_id, citations = "", None, []

    is_refusal = len(citations) == 0
    final_answer = (
        REFUSAL_TEMPLATES.get(locale, REFUSAL_TEMPLATES["zh-CN"]) if is_refusal else answer_text
    )

    session.last_response_id = response_id or session.last_response_id
    db.add(
        AvatarInteractionLog(
            session_id=session.id,
            ip_address=session.ip_address,
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
