"""Tests for the citation retrieval service (Phase 32, ANON-03).

Mocks `httpx.AsyncClient.post` — never calls live Azure services.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.avatar_search_service import retrieve_citations


def _mock_response(references: list[dict]):
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {"references": references}
    return response


def _mock_client(response):
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=None)
    return context


class TestRetrieveCitations:
    async def test_drops_references_missing_any_full_field(self):
        """Only references with title+url+page ALL present survive; any
        reference missing even one field is silently dropped, never partial."""
        references = [
            {"docKey": "1", "sourceData": {"title": "T1", "url": "https://a", "page": 1}},
            {"docKey": "2", "sourceData": {"title": "T2", "url": "https://b"}},  # missing page
            {"docKey": "3", "sourceData": {"url": "https://c", "page": 3}},  # missing title
            {"docKey": "4", "sourceData": None},
        ]
        with (
            patch(
                "app.services.avatar_search_service.httpx.AsyncClient",
                return_value=_mock_client(_mock_response(references)),
            ),
            patch(
                "app.services.avatar_search_service._search_auth_headers",
                AsyncMock(return_value={}),
            ),
        ):
            citations = await retrieve_citations("https://search.example", "kb1", "question")

        assert citations == [{"title": "T1", "url": "https://a", "page": 1}]

    async def test_caps_at_three_keeping_first_matches_in_order(self):
        references = [
            {"docKey": str(i), "sourceData": {"title": f"T{i}", "url": f"https://{i}", "page": i}}
            for i in range(1, 6)
        ]
        with (
            patch(
                "app.services.avatar_search_service.httpx.AsyncClient",
                return_value=_mock_client(_mock_response(references)),
            ),
            patch(
                "app.services.avatar_search_service._search_auth_headers",
                AsyncMock(return_value={}),
            ),
        ):
            citations = await retrieve_citations("https://search.example", "kb1", "question")

        assert len(citations) == 3
        assert [c["page"] for c in citations] == [1, 2, 3]

    async def test_returns_empty_list_when_no_references(self):
        with (
            patch(
                "app.services.avatar_search_service.httpx.AsyncClient",
                return_value=_mock_client(_mock_response([])),
            ),
            patch(
                "app.services.avatar_search_service._search_auth_headers",
                AsyncMock(return_value={}),
            ),
        ):
            citations = await retrieve_citations("https://search.example", "kb1", "question")

        assert citations == []

    async def test_returns_empty_list_when_references_key_absent(self):
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = {}
        with (
            patch(
                "app.services.avatar_search_service.httpx.AsyncClient",
                return_value=_mock_client(response),
            ),
            patch(
                "app.services.avatar_search_service._search_auth_headers",
                AsyncMock(return_value={}),
            ),
        ):
            citations = await retrieve_citations("https://search.example", "kb1", "question")

        assert citations == []
