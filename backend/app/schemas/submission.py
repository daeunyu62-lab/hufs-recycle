from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import SubmissionStatus


class SubmissionCreateResponse(BaseModel):
    submission_id: int
    status: SubmissionStatus
    distance_m: float
    remaining_today: int
    message: str


class SubmissionPublic(BaseModel):
    id: int
    user_id: int
    location_id: int
    image_path: str
    latitude: float
    longitude: float
    accuracy_m: float
    distance_m: float
    status: SubmissionStatus
    submitted_at: datetime
    reviewed_at: datetime | None
    reviewed_by: int | None
    rejection_reason: str | None

    model_config = ConfigDict(from_attributes=True)


class SubmissionListResponse(BaseModel):
    items: list[SubmissionPublic]
    page: int
    page_size: int
    total: int
