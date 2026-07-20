from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.location import LocationPublic
from app.services.location_service import get_location_by_qr_token

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/{qr_token}", response_model=LocationPublic)
def read_location_by_qr_token(
    qr_token: str,
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return get_location_by_qr_token(db, qr_token)
