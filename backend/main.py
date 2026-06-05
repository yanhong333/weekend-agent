from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.agent import build_mock_plan
from backend.schemas import PlanRequest, PlanResponse


app = FastAPI(
    title="WeekendPilot API",
    description="Local activity planning agent backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "name": "WeekendPilot",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/plan", response_model=PlanResponse)
def create_plan(request: PlanRequest) -> PlanResponse:
    return build_mock_plan(request)
