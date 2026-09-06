FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend:/app

WORKDIR /app
COPY backend ./backend
COPY worker ./worker
RUN pip install --no-cache-dir ./backend

CMD ["celery", "-A", "worker.app.celery_app.celery_app", "worker", "--loglevel=INFO"]
