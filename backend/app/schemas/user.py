from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserPublic(BaseModel):
    id: int
    email: str
    student_number: str
    name: str
    role: UserRole
    is_active: bool
    email_verified_at: datetime | None
    mileage_balance: int

    model_config = ConfigDict(from_attributes=True)
