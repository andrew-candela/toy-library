FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

# Install into the system interpreter (as before) rather than a /app/.venv,
# so start.sh can keep calling alembic/uvicorn directly.
ENV UV_PROJECT_ENVIRONMENT=/usr/local \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install locked third-party deps first so this layer is cached until the lockfile changes.
# --locked fails the build if uv.lock is out of date with pyproject.toml.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY start.sh .

RUN uv sync --locked --no-dev --no-editable

RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
