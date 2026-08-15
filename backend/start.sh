#!/bin/sh
set -e

# Prometheus multiprocess mode: one shared dir for all worker .db files.
# The dir is created fresh on each boot to flush stale files from dead workers.
export PROMETHEUS_MULTIPROC_DIR="${PROMETHEUS_MULTIPROC_DIR:-/tmp/prometheus_multiproc}"
mkdir -p "$PROMETHEUS_MULTIPROC_DIR"
find "$PROMETHEUS_MULTIPROC_DIR" -name "*.db" -delete

export TOY_IMAGE_STORAGE_DIR="${TOY_IMAGE_STORAGE_DIR:-/data/images}"
mkdir -p "$TOY_IMAGE_STORAGE_DIR"

alembic upgrade head

ENVIRONMENT="${ENVIRONMENT:-prod}"

if [ "$ENVIRONMENT" = "dev" ]; then
    exec \
        uvicorn \
        app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload
else
    exec \
        uvicorn \
        app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --no-access-log
fi

