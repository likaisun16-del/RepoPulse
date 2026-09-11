from __future__ import annotations

import os
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

from app.config import get_settings


def cache_dir() -> Path:
    path = Path(get_settings().avatar_cache_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def avatar_path(owner_id: int) -> Path:
    return cache_dir() / f"{owner_id}.img"


def is_fresh(path: Path) -> bool:
    return path.exists() and datetime.fromtimestamp(path.stat().st_mtime, UTC) > datetime.now(
        UTC
    ) - timedelta(days=get_settings().avatar_refresh_days)


def download_avatar(owner_id: int, url: str) -> Path:
    if not url.startswith(("https://github.com/", "https://avatars.githubusercontent.com/")):
        raise ValueError("unsupported avatar host")
    target = avatar_path(owner_id)
    with httpx.Client(
        timeout=get_settings().avatar_request_timeout, follow_redirects=True
    ) as client:
        response = client.get(url, headers={"User-Agent": "RepoPulse/0.1"})
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";", 1)[0]
        if content_type not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
            raise ValueError("unsupported avatar content type")
        if len(response.content) > 1_048_576:
            raise ValueError("avatar too large")
        fd, temporary = tempfile.mkstemp(prefix=f"{owner_id}-", dir=cache_dir())
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(response.content)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return target
