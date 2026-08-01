"""Direct Azure AI Search `retrieve` REST client for anonymous avatar citations
(Phase 32, ANON-03).

Citations are strictly full-field-gated (T-32-07): any reference missing
`title`, `url`, or `page` in `sourceData` is silently dropped — partial
citations never leave this service layer. A zero-length result is the
"no match" signal that drives the fixed refusal template in
`avatar_service.py`, never a fabricated answer.
"""

import httpx

from app.services.knowledge_base_service import _search_auth_headers

# Matches knowledge_base_service.py's existing SEARCH_API_VERSION constant —
# keep both in sync if the Foundry IQ / AI Search retrieve API version changes.
SEARCH_API_VERSION = "2026-05-01-preview"

DEFAULT_MAX_CITATIONS = 3


def _build_retrieve_url(endpoint: str, kb_name: str) -> str:
    base = endpoint.rstrip("/")
    return f"{base}/knowledgebases/{kb_name}/retrieve?api-version={SEARCH_API_VERSION}"


async def retrieve_citations(
    connection_target: str,
    index_name: str,
    query: str,
    search_key: str = "",
    max_citations: int = DEFAULT_MAX_CITATIONS,
) -> list[dict]:
    """Retrieve up to `max_citations` full-field citations for `query`.

    Returns `[]` when the response's `references[]` is empty/absent (the
    "no match" signal) or when no reference has all three required fields.
    """
    headers = await _search_auth_headers(search_key)
    body = {
        "messages": [{"role": "user", "content": [{"type": "text", "text": query}]}],
        "knowledgeSourceParams": [{"knowledgeSourceName": index_name, "kind": "searchIndex"}],
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _build_retrieve_url(connection_target, index_name), json=body, headers=headers
        )
        resp.raise_for_status()

    references = resp.json().get("references", []) or []
    citations: list[dict] = []
    for ref in references:
        data = ref.get("sourceData") or {}
        title, url, page = data.get("title"), data.get("url"), data.get("page")
        if title and url and page:  # strict full-field gate — drop on ANY missing field
            citations.append({"title": title, "url": url, "page": page})
        if len(citations) == max_citations:
            break
    return citations
