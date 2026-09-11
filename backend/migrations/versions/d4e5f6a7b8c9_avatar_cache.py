"""add repository owner avatar metadata"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("repositories", sa.Column("owner_github_id", sa.BigInteger(), nullable=True))
    op.add_column("repositories", sa.Column("owner_avatar_url", sa.String(length=500), nullable=True))
    op.create_index("ix_repositories_owner_github_id", "repositories", ["owner_github_id"])

def downgrade() -> None:
    op.drop_index("ix_repositories_owner_github_id", table_name="repositories")
    op.drop_column("repositories", "owner_avatar_url")
    op.drop_column("repositories", "owner_github_id")
