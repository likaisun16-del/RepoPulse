"""add one-day rankings and baseline status

Revision ID: b1c4e8a2d6f0
Revises: 986baf76c7f6
Create Date: 2026-09-06 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b1c4e8a2d6f0"
down_revision: str | None = "986baf76c7f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("ranking_runs", recreate="always") as batch_op:
            batch_op.drop_constraint("ck_ranking_period", type_="check")
            batch_op.create_check_constraint(
                "ck_ranking_period",
                "period_days IN (1, 7, 14, 30)",
            )
    else:
        op.drop_constraint("ck_ranking_period", "ranking_runs", type_="check")
        op.create_check_constraint(
            "ck_ranking_period",
            "ranking_runs",
            "period_days IN (1, 7, 14, 30)",
        )
    op.add_column(
        "ranking_items",
        sa.Column(
            "baseline_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("ranking_items", "baseline_available")
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("ranking_runs", recreate="always") as batch_op:
            batch_op.drop_constraint("ck_ranking_period", type_="check")
            batch_op.create_check_constraint(
                "ck_ranking_period",
                "period_days IN (7, 14, 30)",
            )
    else:
        op.drop_constraint("ck_ranking_period", "ranking_runs", type_="check")
        op.create_check_constraint(
            "ck_ranking_period",
            "ranking_runs",
            "period_days IN (7, 14, 30)",
        )
