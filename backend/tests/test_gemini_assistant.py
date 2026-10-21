"""Mock-only provider tests; internal fixtures are never operational demo data."""
import json
from datetime import datetime, timedelta, timezone
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app import app
from src import gemini_assistant as ai
from src.demo_routes import get_demo_reader
from src.workbench import FACILITY_ASSETS
ID="00000000-0000-4000-8000-000000000001"
OTHER="00000000-0000-4000-8000-000000000002"
KEY="test-only-provider-credential"
PROV=dict(source_code="bdg2_v1",kind="public_benchmark")
class Reader:
    def __init__(self): self.paths=[]
    async def asset(self, asset_id):
        if str(asset_id)!=ID: raise HTTPException(404,"Asset not found")
        return dict(id=ID,source_asset_id="test_building",timezone="US/Central",scope="whole_building",floor_area_m2=100,provenance=PROV,private_field="excluded")
    async def read(self,path):
        self.paths.append(path)
        base=dict(asset_id=ID,unit="kWh",provenance=PROV)
        stamp=datetime(2018,1,1,tzinfo=timezone.utc)
        if "anomalies" in path:
            return dict(**base,count=1,items=[dict(timestamp=stamp.isoformat(),label="unusual_consumption_pattern",direction="above_expected",observed_kwh=20,forecast_kwh=10,residual_kwh=10,cause=None)])
        if "forecast" in path:
            return dict(**base,test_metrics=dict(model=dict(mae_kwh=1,rmse_kwh=2)),items=[dict(timestamp=(stamp+timedelta(hours=i+24)).isoformat(),forecast_kwh=10.,unit="kWh",label="forecast") for i in range(24)])
        return dict(**base,items=[dict(timestamp=(stamp+timedelta(hours=i)).isoformat(),consumption_kwh=10.,interval_minutes=60,label="observed",quality_status="observed") for i in range(24)])
def provider(answer="Observed interval is 10 kWh.",citations=("observations",)):
    result=dict(answer=answer)
    if citations is not None: result["citations"]=list(citations)
    return dict(candidates=[dict(finishReason="STOP",content=dict(parts=[dict(text=json.dumps(result))]))])
@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY",KEY);monkeypatch.delenv("GEMINI_MODEL",raising=False)
    monkeypatch.setattr(ai,"limiter",ai.RateLimiter())
    reader=Reader();calls=[]
    def handle(request):
        calls.append(request);return httpx.Response(200,json=provider())
    app.dependency_overrides[get_demo_reader]=lambda:reader
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(handle))
    with TestClient(app) as client: yield client,reader,calls
    app.dependency_overrides.clear()
def ask(client,**extra):
    return client.post("/demo/assistant/chat",json=dict(message="Explain observations",asset_id=ID,**extra))
def test_selected_asset_evidence_header_only_key_and_no_tools(setup):
    client,reader,calls=setup;response=ask(client)
    assert response.status_code==200
    result=response.json()
    assert result["read_only"] and result["asset_id"]==ID
    assert result["citations"][0]["url"]==ai.DOI and "not Sime Darby" in result["disclosure"]
    request=calls[0];payload=json.loads(request.content)
    assert request.url.host=="generativelanguage.googleapis.com" and request.headers["x-goog-api-key"]==KEY
    assert KEY not in request.content.decode() and KEY not in str(request.url)
    assert "tools" not in payload and "private_field" not in request.content.decode() and OTHER not in request.content.decode()
    assert len(reader.paths)==3 and all(ID in path for path in reader.paths)
    assert "never a cause" in payload["systemInstruction"]["parts"][0]["text"]
    assert client.get("/health").json()==dict(status="ok",version="1")

def test_nexora_copilot_uses_gemini_with_selected_township_context(setup):
    client,_,calls=setup
    facility_id=next(iter(FACILITY_ASSETS))
    def handle(request):
        calls.append(request)
        return httpx.Response(200,json=provider("This is an illustrative facility profile, not a measured site reading.",("limitations",)))
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(handle))
    response=client.post("/api/workbench/copilot/gemini",json={"asset_id":facility_id,"period":"day","question":"What are these alerts?"})
    assert response.status_code==200,response.text
    result=response.json()
    assert result["provider"]=="Gemini" and result["read_only"]
    assert result["citations"][0]["label"]=="Data and simulation limitations"
    sent=json.loads(calls[0].content)
    assert "NEXORA Copilot" in sent["systemInstruction"]["parts"][0]["text"]
    assert "illustrative_alerts" in sent["contents"][0]["parts"][0]["text"]
    assert KEY not in calls[0].content.decode()

def test_valid_grounded_answer_without_model_citation_tokens_gets_server_evidence(setup):
    client,_,_=setup
    answer="Equipment, floor, HVAC, tariff, savings and live-control information is unavailable for this building."
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(lambda req:httpx.Response(200,json=provider(answer,None))))
    response=ask(client);assert response.status_code==200
    result=response.json();assert result["answer"]==answer
    assert [citation["id"] for citation in result["citations"]]==["observations","forecast","anomalies","limitations"]
def test_missing_key_status_and_no_provider_call(setup,monkeypatch):
    client,reader,calls=setup;monkeypatch.delenv("GEMINI_API_KEY")
    assert client.get("/demo/assistant/status").json()["available"] is False
    assert ask(client).status_code==503 and reader.paths==[] and calls==[]
@pytest.mark.parametrize("body",[dict(message=" ",asset_id=ID),dict(message="x"*1501,asset_id=ID),dict(message="x",asset_id="invalid"),dict(message="x",asset_id=ID,tools=["write"]),dict(message="x",asset_id=ID,scenario=dict(kind="peak_shift",inputs=dict(asset_id=OTHER,flexible_load_kwh=1,from_interval=0,to_interval=1))),dict(message="x",asset_id=ID,scenario=dict(kind="peak_shift",inputs=dict(asset_id=ID,flexible_load_kwh=1,from_interval=0,to_interval=1),results=dict(verified_savings=999)))])
def test_invalid_requests_do_not_echo_inputs(setup,body):
    client,_,calls=setup;response=client.post("/demo/assistant/chat",json=body)
    assert response.status_code==422 and calls==[] and "verified_savings" not in response.text

def test_request_body_limits_including_streamed_body(setup):
    client,_,calls=setup
    for content in ["x"*13000,iter([b"x"*7000,b"x"*7000])]:
        assert client.post("/demo/assistant/chat",content=content,headers={"Content-Type":"application/json"}).status_code==413
    assert client.post("/demo/assistant/chat",content="text").status_code==415 and calls==[]
def test_scenario_is_recomputed_and_labelled(setup):
    client,_,calls=setup
    assert ask(client,scenario=dict(kind="peak_shift",inputs=dict(asset_id=ID,flexible_load_kwh=2,from_interval=0,to_interval=1))).status_code==200
    text=json.loads(calls[0].content)["contents"][0]["parts"][0]["text"]
    evidence=json.loads(text.split("EVIDENCE_JSON\n")[1].split("\nUSER_MESSAGE")[0])
    assert evidence["simulation"]["label"]=="simulated" and evidence["simulation"]["energy_balance_kwh"]==0
    assert evidence["simulation"]["assumptions"]["flexible_load_kwh"]==2
@pytest.mark.parametrize("answer,citations",[("No measurements.",["simulation"]),("Energy is 999999 kWh.",["observations"]),(KEY,["limitations"])])
def test_ungrounded_or_credential_output_is_rejected(setup,answer,citations):
    client,_,_=setup
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(lambda req:httpx.Response(200,json=provider(answer,citations))))
    response=ask(client);assert response.status_code==502 and KEY not in response.text
@pytest.mark.parametrize("status,expected",[(401,503),(500,503),(429,429)])
def test_provider_errors_are_sanitized(setup,status,expected):
    client,_,_=setup
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(lambda req:httpx.Response(status,text=KEY)))
    response=ask(client);assert response.status_code==expected and KEY not in response.text
    if expected==429: assert response.headers["Retry-After"]=="60"
def test_timeout_and_tool_output_are_safe(setup):
    client,_,_=setup
    def timeout(req): raise httpx.ReadTimeout(KEY)
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(timeout))
    assert ask(client).status_code==504
    data=dict(candidates=[dict(finishReason="STOP",content=dict(parts=[dict(functionCall=dict(name="control"))]))])
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(lambda req:httpx.Response(200,json=data)))
    assert ask(client).status_code==502

def test_bad_evidence_and_credential_input_never_reach_provider(setup):
    client,reader,calls=setup
    assert client.post("/demo/assistant/chat",json=dict(message=KEY,asset_id=ID)).status_code==422 and calls==[]
    original=reader.read
    async def wrong(path):
        result=await original(path);result["asset_id"]=OTHER;return result
    reader.read=wrong
    assert ask(client).status_code==503 and calls==[]
def test_rate_limits_ignore_spoofed_forwarded_headers(setup):
    client,_,calls=setup
    for i in range(5):
        assert client.post("/demo/assistant/chat",json=dict(message="Explain",asset_id=ID),headers={"X-Forwarded-For":str(i)}).status_code==200
    assert ask(client).status_code==429 and len(calls)==5

def test_rate_window_global_budget_concurrency_and_memory():
    now=[0.];limiter=ai.RateLimiter(lambda:now[0])
    limiter.acquire("one");limiter.acquire("two")
    with pytest.raises(HTTPException):limiter.acquire("three")
    limiter.release();limiter.release()
    for i in range(18):limiter.acquire(str(i));limiter.release()
    for i in range(100):
        with pytest.raises(HTTPException):limiter.acquire("rejected"+str(i))
    assert len(limiter.clients)==20
    now[0]=61;limiter.acquire("new");limiter.release()
    assert len(limiter.clients)==1 and len(limiter.global_calls)==1

@pytest.mark.parametrize("payload",[[],{},dict(candidates=[None]),dict(candidates=[dict(finishReason="SAFETY")]),dict(candidates=[dict(finishReason="STOP",content=dict(parts=[dict(text="not json")]))])])
def test_malformed_or_blocked_provider_response_is_safe(setup,payload):
    client,_,_=setup
    app.dependency_overrides[ai.get_gateway]=lambda:ai.GeminiGateway(httpx.MockTransport(lambda req:httpx.Response(200,json=payload)))
    assert ask(client).status_code==502
