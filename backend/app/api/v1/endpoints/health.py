from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def read_health() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
    }


@router.get("/health/db")
def read_database_health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "ok",
    }
