from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend API for the HUFS Eco Mileage service.",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    application.include_router(api_router, prefix=settings.api_v1_prefix)

    if settings.storage_backend == "local":
        upload_dir = Path(settings.local_upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        application.mount(
            "/uploads",
            StaticFiles(directory=upload_dir),
            name="uploads",
        )

    return application


app = create_app()
