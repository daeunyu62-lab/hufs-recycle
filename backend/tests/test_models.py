import app.models  # noqa: F401
from app.db.base import Base
from app.models.enums import PointTransactionType, SubmissionStatus, UserRole
from app.models.point_transaction import PointTransaction
from sqlalchemy import UniqueConstraint


def test_initial_model_tables_are_registered() -> None:
    assert {
        "users",
        "disposal_locations",
        "submissions",
        "point_transactions",
    }.issubset(Base.metadata.tables)


def test_required_enums_are_stable() -> None:
    assert [role.value for role in UserRole] == ["USER", "ADMIN"]
    assert [status.value for status in SubmissionStatus] == [
        "PENDING",
        "APPROVED",
        "REJECTED",
    ]
    assert [transaction_type.value for transaction_type in PointTransactionType] == [
        "EARN",
        "USE",
        "CANCEL",
    ]


def test_point_transaction_prevents_duplicate_submission_transaction_type() -> None:
    constraints = [
        constraint
        for constraint in PointTransaction.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    ]

    assert any(
        constraint.name == "uq_point_transactions_submission_transaction_type"
        and {column.name for column in constraint.columns}
        == {"submission_id", "transaction_type"}
        for constraint in constraints
    )
