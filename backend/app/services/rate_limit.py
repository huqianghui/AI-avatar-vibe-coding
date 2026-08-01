"""Dual-key rate limiting infrastructure for anonymous avatar endpoints.

Provides two independent-looking `.limit()` decorators — one keyed by remote
IP, one keyed by the client-supplied anonymous session token — so abuse can
be throttled per-IP and per-session independently (T-32-01). Neither key is
trusted as an identity claim; both are coarse abuse-throttling buckets only.

IMPORTANT — why this is ONE Limiter instance under the hood, not two:
slowapi's auto-check wrapper gates itself on a *per-request* shared flag
(`request.state._rate_limiting_complete`), not a per-instance flag. If you
stack `.limit()` decorators from two different `Limiter()` instances on the
same route, only the OUTERMOST instance's own `_route_limits` registry is
ever evaluated — the inner instance's check is silently skipped entirely.

This was proven empirically: with two plain `Limiter(key_func=...)`
instances stacked on one route, a fixed session header + 4 different
simulated client IPs returned 200 on every request, even though the same
session key was reused past its configured limit (the session-keyed
instance's check never ran).

Fix: register both the IP-keyed and session-keyed limit rules on the SAME
underlying `Limiter` instance, each with its own explicit `key_func=`.
slowapi evaluates every `Limit` registered for an endpoint in one
`__evaluate_limits()` pass per request, so both key spaces are checked
independently within that single pass — regardless of decorator stacking
order. `limiter_ip` and `limiter_session` below present the same call-site
shape as two independent limiters (`@limiter_x.limit("N/period")`) so route
code can stack them exactly as if they were separate, while both actually
delegate registration to one shared instance.
"""

from typing import Any

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_anon_session_key(request: Request) -> str:
    """Rate-limit key derived from the anonymous session token header, falling back
    to remote IP only when the header is absent (e.g. the session-creation route
    itself, which has no session yet)."""
    return request.headers.get("X-Anon-Session", get_remote_address(request))


class _KeyedLimiterProxy:
    """`.limit()`-decorator facade bound to a fixed `key_func`, backed by a shared
    `Limiter` instance. See module docstring for why sharing one instance
    underneath is required for independent dual-key enforcement."""

    def __init__(self, limiter: Limiter, key_func: Any) -> None:
        self._limiter = limiter
        self._key_func = key_func

    def limit(self, limit_value: str, **kwargs: Any) -> Any:
        kwargs.setdefault("key_func", self._key_func)
        return self._limiter.limit(limit_value, **kwargs)


# Single underlying slowapi Limiter instance shared by both proxies below.
# Also registered as `app.state.limiter` in app.main (required by slowapi
# internally, even though we never add SlowAPIMiddleware).
_shared_limiter = Limiter(key_func=get_remote_address)

# Public API: stack `@limiter_ip.limit(...)` and `@limiter_session.limit(...)`
# on a route to get independently-enforced IP and session rate limits.
limiter_ip = _shared_limiter
limiter_session = _KeyedLimiterProxy(_shared_limiter, get_anon_session_key)
