from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_admin, get_db
from app.models import SubmissionStatus, User
from app.schemas.admin import (
    AdminLocationListResponse,
    AdminStatisticsResponse,
    AdminSubmissionDetail,
    AdminSubmissionListResponse,
    RejectSubmissionRequest,
)
from app.schemas.location import (
    AdminLocationCreate,
    AdminLocationPublic,
    AdminLocationUpdate,
)
from app.schemas.submission import SubmissionPublic
from app.services.admin_service import (
    approve_submission,
    get_admin_statistics,
    get_submission_for_admin,
    list_admin_submissions,
    reject_submission,
)
from app.services.location_service import (
    create_location,
    list_locations,
    update_location,
)
from app.services.storage_service import get_storage_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/locations", response_model=AdminLocationListResponse)
def read_admin_locations(
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminLocationListResponse:
    items = list_locations(db)
    return AdminLocationListResponse(items=items, total=len(items))


@router.post("/locations", response_model=AdminLocationPublic)
def create_admin_location(
    request: AdminLocationCreate,
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return create_location(db, request)


@router.patch("/locations/{location_id}", response_model=AdminLocationPublic)
def update_admin_location(
    location_id: int,
    request: AdminLocationUpdate,
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return update_location(db, location_id, request)


@router.get("/submissions", response_model=AdminSubmissionListResponse)
def read_admin_submissions(
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[SubmissionStatus | None, Query(alias="status")] = None,
    user_id: int | None = None,
    location_id: int | None = None,
    submitted_from: datetime | None = None,
    submitted_to: datetime | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminSubmissionListResponse:
    items, total = list_admin_submissions(
        db=db,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
        user_id=user_id,
        location_id=location_id,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
    )
    return AdminSubmissionListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/submissions/{submission_id}", response_model=AdminSubmissionDetail)
def read_admin_submission(
    submission_id: int,
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminSubmissionDetail:
    submission = get_submission_for_admin(db, submission_id)
    public = SubmissionPublic.model_validate(submission).model_dump()
    return AdminSubmissionDetail(
        **public,
        image_url=get_storage_service().create_signed_url(submission.image_path),
    )


@router.patch("/submissions/{submission_id}/approve", response_model=SubmissionPublic)
def approve_admin_submission(
    submission_id: int,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return approve_submission(db, submission_id, admin)


@router.patch("/submissions/{submission_id}/reject", response_model=SubmissionPublic)
def reject_admin_submission(
    submission_id: int,
    request: RejectSubmissionRequest,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return reject_submission(db, submission_id, admin, request.reason)


@router.get("/statistics", response_model=AdminStatisticsResponse)
def read_admin_statistics(
    _: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    return get_admin_statistics(db)
