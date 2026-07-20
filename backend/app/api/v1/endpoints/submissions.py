from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_verified_user, get_db
from app.models import User
from app.schemas.submission import (
    SubmissionCreateResponse,
    SubmissionEligibilityResponse,
    SubmissionPublic,
)
from app.services.submission_service import (
    create_submission,
    get_submission_eligibility,
    get_submission_for_user,
)

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post("", response_model=SubmissionCreateResponse)
async def submit_recycling_photo(
    user: Annotated[User, Depends(get_current_verified_user)],
    db: Annotated[Session, Depends(get_db)],
    latitude: Annotated[float, Form()],
    longitude: Annotated[float, Form()],
    accuracy_m: Annotated[float, Form()],
    photo: Annotated[UploadFile, File()],
    qr_token: Annotated[str | None, Form()] = None,
    bin_id: Annotated[str | None, Form()] = None,
    token: Annotated[str | None, Form()] = None,
) -> dict[str, object]:
    return await create_submission(
        db=db,
        user=user,
        qr_token=qr_token,
        bin_id=bin_id,
        token=token,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        photo=photo,
    )


@router.get("/eligibility", response_model=SubmissionEligibilityResponse)
def read_submission_eligibility(
    user: Annotated[User, Depends(get_current_verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    return get_submission_eligibility(db, user.id)


@router.get("/{submission_id}", response_model=SubmissionPublic)
def read_submission(
    submission_id: int,
    user: Annotated[User, Depends(get_current_verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return get_submission_for_user(db, submission_id, user)
