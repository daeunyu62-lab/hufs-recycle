from pydantic import BaseModel, Field

from app.schemas.location import AdminLocationPublic
from app.schemas.submission import SubmissionPublic


class RejectSubmissionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdminSubmissionPublic(SubmissionPublic):
    user_email: str
    user_student_number: str
    user_name: str


class AdminSubmissionDetail(AdminSubmissionPublic):
    image_url: str | None = None


class AdminSubmissionListResponse(BaseModel):
    items: list[AdminSubmissionPublic]
    page: int
    page_size: int
    total: int


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
