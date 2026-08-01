"""Run manually against a live dev Azure AI Search resource to confirm
sourceDataFields include title+url+page before relying on real (non-empty)
citations in production; safe to run repeatedly, makes no writes.

Standalone diagnostic — NOT run by pytest/CI. Loads the active
`PublicKnowledgeConfig` from the dev DB and calls `retrieve_citations()`
with a sample query, printing the raw `references[]`/`sourceData` shape to
stdout. Closes the VALIDATION.md Wave-0 live-index spike gap without
blocking automated tests (which mock httpx, never call live Azure services).

Run with: python scripts/verify_knowledge_source_fields.py "<sample question>"
"""

import asyncio
import json
import sys
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.public_knowledge_config import PublicKnowledgeConfig
from app.services.knowledge_base_service import _search_auth_headers

settings = get_settings()

DEFAULT_QUERY = "What products does the company offer?"


async def main() -> None:
    query = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUERY

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(
            select(PublicKnowledgeConfig).where(PublicKnowledgeConfig.is_active == True)  # noqa: E712
        )
        config = result.scalar_one_or_none()

    if config is None:
        print("No active PublicKnowledgeConfig row found. Nothing to verify.")
        await engine.dispose()
        return

    import httpx

    from app.services.avatar_search_service import _build_retrieve_url

    headers = await _search_auth_headers("")
    body = {
        "messages": [{"role": "user", "content": [{"type": "text", "text": query}]}],
        "knowledgeSourceParams": [
            {"knowledgeSourceName": config.index_name, "kind": "searchIndex"}
        ],
    }

    print(f"Querying knowledge base '{config.index_name}' with: {query!r}")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _build_retrieve_url(config.connection_target, config.index_name),
            json=body,
            headers=headers,
        )

    print(f"HTTP {resp.status_code}")
    payload = resp.json()
    references = payload.get("references", [])
    print(f"references[] count: {len(references)}")
    for i, ref in enumerate(references):
        source_data = ref.get("sourceData")
        print(f"--- reference[{i}] ---")
        print(json.dumps({"docKey": ref.get("docKey"), "sourceData": source_data}, indent=2))
        if isinstance(source_data, dict):
            missing = [f for f in ("title", "url", "page") if not source_data.get(f)]
            if missing:
                print(f"  MISSING fields (would be dropped): {missing}")
            else:
                print("  full-field: title+url+page all present")
        else:
            print("  sourceData is None/missing (would be dropped)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
