"""Verify the public deployment contract without external services."""

from fastapi.testclient import TestClient

from app import app


def test_health_contract_without_credentials(monkeypatch):
    for name in ("SUPABASE_URL", "SUPABASE_SECRET_KEY", "ADMIN_API_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok", "version": "1"}


def test_docs_reference_the_served_openapi_contract():
    with TestClient(app) as client:
        docs = client.get("/docs")
        schema_response = client.get("/openapi.json")
    assert docs.status_code == 200
    assert docs.headers["content-type"].startswith("text/html")
    assert "SwaggerUIBundle" in docs.text
    assert "/openapi.json" in docs.text
    assert schema_response.status_code == 200
    schema = schema_response.json()
    assert schema["info"]["version"] == "1"
    assert {
        "/health",
        "/assets",
        "/assets/{asset_id}/readings",
        "/assets/{asset_id}/forecast",
        "/assets/{asset_id}/anomalies",
    } <= set(schema["paths"])
    health_schema = schema["components"]["schemas"]["HealthResponse"]
    assert health_schema["properties"]["status"]["const"] == "ok"
    assert health_schema["properties"]["version"]["const"] == "1"


def test_planned_features_are_unavailable():
    with TestClient(app) as client:
        assert client.get("/v1/assets").status_code == 404
        assert client.post("/v1/scenarios/preview", json={}).status_code == 404
        assert client.post("/health", json={}).status_code == 405


def test_database_routes_fail_explicitly_without_backend_credentials(monkeypatch):
    for name in ("SUPABASE_URL", "SUPABASE_SECRET_KEY"):
        monkeypatch.delenv(name, raising=False)
    with TestClient(app) as client:
        response = client.get("/assets")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database-backed BDG2 data is unavailable"}

