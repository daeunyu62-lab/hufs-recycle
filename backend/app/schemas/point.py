from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import PointTransactionType


class PointTransactionPublic(BaseModel):
    id: int
    submission_id: int | None
    amount: int
    transaction_type: PointTransactionType
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PointBalanceResponse(BaseModel):
    balance: int
    transactions: list[PointTransactionPublic]
    page: int
    page_size: int
    total: int
