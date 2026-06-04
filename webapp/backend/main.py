import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="TradingAgents Workbench API", version="0.1.0")
    origins = os.environ.get("WORKBENCH_CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    from webapp.backend.routes.runs import router as runs_router
    app.include_router(runs_router)

    from webapp.backend.routes.memory import router as memory_router
    app.include_router(memory_router)

    from webapp.backend.routes.config import router as config_router
    app.include_router(config_router)

    from webapp.backend.routes.providers import router as providers_router
    app.include_router(providers_router)

    from webapp.backend.routes.markets import router as markets_router
    app.include_router(markets_router)

    return app


app = create_app()
