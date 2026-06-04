import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_routes_register():
    app = create_app()
    paths = {route.path for route in app.routes}
    assert "/api/health" in paths
    assert "/api/runs" in paths
    assert "/api/runs/{run_id}/stream" in paths
    assert "/api/config" in paths
    assert "/api/providers/health" in paths
    assert "/api/markets/{ticker}" in paths


@pytest.mark.asyncio
async def test_health_live():
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as c:
        r = await c.get("/api/health")
        assert r.status_code == 200
