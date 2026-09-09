"""Persist worker checkpoints for resumable collection."""

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b1c4e8a2d6f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_runs", sa.Column("progress", sa.JSON(), nullable=True))
    op.add_column("job_runs", sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("job_runs", "cancel_requested")
    op.drop_column("job_runs", "progress")
