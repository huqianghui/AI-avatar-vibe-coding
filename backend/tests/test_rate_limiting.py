"""Dual-key rate limiter behavior tests (Phase 32, ANON-01 / T-32-01 / T-32-02).

Builds a throwaway FastAPI app with a dummy route decorated with BOTH
`limiter_ip` and `limiter_session` (do NOT modify production routes here --
this proves the pattern works before Plan 32-02/03 depend on it).
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient
from slowapi.errors import RateLimitExceeded

from app.services.rate_limit import limiter_ip, limiter_session

rate_limit_app = FastAPI()
rate_limit_app.state.limiter = limiter_ip


@rate_limit_app.exception_handler(RateLimitExceeded)
async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    response = JSONResponse(
        status_code=429,
        content={
            "code": "RATE_LIMITED",
            "message": "Too many requests. Please wait and try again.",
            "details": {"limit": str(exc.detail)},
        },
    )
    response.headers["Retry-After"] = "60"
    return response


@rate_limit_app.get("/dummy-ip-only")
@limiter_ip.limit("2/minute")
async def dummy_ip_only(request: Request):
    return {"ok": True}


@rate_limit_app.get("/dummy-dual")
@limiter_ip.limit("2/minute")
@limiter_session.limit("2/minute")
async def dummy_dual(request: Request):
    return {"ok": True}


@pytest.fixture(autouse=True)
def _reset_limiter_storage():
    """Prevent cross-test pollution: limiter_ip/limiter_session share one
    underlying storage bucket keyed by (limit_value, key), so state must be
    cleared between tests regardless of which route/key was hit."""
    limiter_ip.reset()
    yield
    limiter_ip.reset()


async def _get(path: str, *, client_ip: str, session: str | None = None) -> int:
    headers = {}
    if session is not None:
        headers["X-Anon-Session"] = session
    transport = ASGITransport(app=rate_limit_app, client=(client_ip, 12345))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(path, headers=headers)
        return response.status_code, response


class TestSingleLimiterEnforcement:
    """A dummy route decorated with @limiter_ip.limit("2/minute") returns 200
    twice then 429 on the 3rd call from the same mock IP within the window."""

    @pytest.mark.asyncio
    async def test_third_request_from_same_ip_is_rate_limited(self):
        statuses = []
        for _ in range(3):
            status, _ = await _get("/dummy-ip-only", client_ip="192.0.2.1")
            statuses.append(status)
        assert statuses == [200, 200, 429]

    @pytest.mark.asyncio
    async def test_different_ips_get_independent_buckets(self):
        status_a1, _ = await _get("/dummy-ip-only", client_ip="192.0.2.10")
        status_a2, _ = await _get("/dummy-ip-only", client_ip="192.0.2.10")
        status_b1, _ = await _get("/dummy-ip-only", client_ip="192.0.2.11")
        assert [status_a1, status_a2, status_b1] == [200, 200, 200]


class TestDualKeyIndependentEnforcement:
    """Pitfall 3 (unverified dual-limiter assumption): a route decorated with
    BOTH @limiter_ip.limit(...) and @limiter_session.limit(...) must enforce
    each key space independently, regardless of decorator stacking order."""

    @pytest.mark.asyncio
    async def test_fixed_session_changing_ip_does_not_trip_session_limiter_early(self):
        """4 requests, fixed session header, 4 different IPs: the IP limiter
        (2/minute) must trip at request 3, proving the session limiter alone
        is not silently absorbing/blocking unrelated IP buckets."""
        statuses = []
        for i in range(4):
            status, _ = await _get(
                "/dummy-dual", client_ip=f"198.51.100.{i}", session="sess-fixed-a"
            )
            statuses.append(status)
        assert statuses == [200, 200, 429, 429]

    @pytest.mark.asyncio
    async def test_fixed_ip_changing_session_does_not_trip_ip_limiter_early(self):
        """4 requests, fixed IP, 4 different session headers: the session
        limiter (2/minute) must trip at request 3, proving the IP limiter
        does not falsely gate on session identity."""
        statuses = []
        for i in range(4):
            status, _ = await _get("/dummy-dual", client_ip="198.51.100.200", session=f"sess-{i}")
            statuses.append(status)
        assert statuses == [200, 200, 429, 429]

    @pytest.mark.asyncio
    async def test_session_limiter_independently_enforces_across_changing_ip(self):
        """Direct proof the session-keyed limit is evaluated at all: reusing
        the SAME session across DIFFERENT IPs must still trip at request 3,
        even though each IP is individually under its own 2/minute cap."""
        statuses = []
        for i in range(3):
            status, _ = await _get("/dummy-dual", client_ip=f"203.0.113.{i}", session="sess-shared")
            statuses.append(status)
        assert statuses[-1] == 429


class TestStructured429Response:
    """The 429 response body matches the project's structured error shape
    (not slowapi's default plain-text body) and includes a Retry-After header."""

    @pytest.mark.asyncio
    async def test_429_body_and_headers(self):
        for _ in range(2):
            await _get("/dummy-ip-only", client_ip="192.0.2.50")
        status, response = await _get("/dummy-ip-only", client_ip="192.0.2.50")

        assert status == 429
        body = response.json()
        assert body["code"] == "RATE_LIMITED"
        assert "message" in body
        assert "details" in body
        assert response.headers.get("Retry-After") == "60"
