import sentry_sdk
from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )

celery_app = Celery(
    "repopulse",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["worker.app.tasks", "worker.app.avatar_tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "discover-candidates-daily": {
            "task": "worker.app.tasks.discover_candidates",
            "schedule": crontab(minute=15, hour=0),
        },
        "capture-snapshots-daily": {
            "task": "worker.app.tasks.capture_daily_snapshots",
            "schedule": crontab(minute=0, hour=2),
        },
        "cleanup-jobs-weekly": {
            "task": "worker.app.tasks.cleanup_failed_jobs",
            "schedule": crontab(minute=30, hour=3, day_of_week="sun"),
        },
        "warmup-top-avatars-daily": {
            "task": "worker.app.avatar_tasks.warmup_avatars",
            "schedule": crontab(minute=30, hour=2),
        },
    },
)
