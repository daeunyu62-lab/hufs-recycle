from enum import StrEnum


class UserRole(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"


class SubmissionStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PointTransactionType(StrEnum):
    EARN = "EARN"
    USE = "USE"
    CANCEL = "CANCEL"

