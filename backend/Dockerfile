FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY start.sh .

RUN uv pip install --system . && chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
