from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db
from app.models import User
from app.schemas.point import PointBalanceResponse
from app.schemas.submission import SubmissionListResponse
from app.schemas.user import UserPublic
from app.services.point_service import (
    get_user_point_balance,
    list_user_point_transactions,
)
from app.services.submission_service import list_user_submissions

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def read_me(user: Annotated[User, Depends(get_current_active_user)]) -> User:
    return user


@router.get("/me/submissions", response_model=SubmissionListResponse)
def read_my_submissions(
    user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SubmissionListResponse:
    items, total = list_user_submissions(db, user.id, page, page_size)
    return SubmissionListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/me/points", response_model=PointBalanceResponse)
def read_my_points(
    user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PointBalanceResponse:
    transactions, total = list_user_point_transactions(db, user.id, page, page_size)
    return PointBalanceResponse(
        balance=get_user_point_balance(db, user.id),
        transactions=transactions,
        page=page,
        page_size=page_size,
        total=total,
    )
