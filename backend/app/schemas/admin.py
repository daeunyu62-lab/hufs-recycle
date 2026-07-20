from pydantic import BaseModel, Field

from app.schemas.location import AdminLocationPublic
from app.schemas.submission import SubmissionListResponse, SubmissionPublic


class RejectSubmissionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdminSubmissionDetail(SubmissionPublic):
    image_url: str | None = None


class AdminSubmissionListResponse(SubmissionListResponse):
    pass


class AdminStatisticsResponse(BaseModel):
    total_submissions: int
    pending_submissions: int
    approved_submissions: int
    rejected_submissions: int
    today_submissions: int
    today_approved: int
    active_users: int
    total_points_awarded: int
    submissions_by_location: list[dict[str, int | str]]


class AdminLocationListResponse(BaseModel):
    items: list[AdminLocationPublic]
    total: int
