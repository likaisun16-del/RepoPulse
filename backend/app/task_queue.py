import logging

from celery import Celery
from celery.exceptions import OperationalError

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
task_sender = Celery("repopulse-api", broker=settings.redis_url)
task_sender.conf.update(
    broker_connection_timeout=1,
    task_ignore_result=True,
)


def enqueue_avatar_refresh(owner_id: int) -> bool:
    try:
        task_sender.send_task(
            "worker.app.avatar_tasks.refresh_avatar",
            args=[owner_id],
            ignore_result=True,
            retry=False,
        )
    except OperationalError:
        logger.warning(
            "Avatar refresh enqueue failed",
            extra={"owner_id": owner_id},
            exc_info=True,
        )
        return False
    return True
