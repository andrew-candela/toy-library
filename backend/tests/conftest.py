"""Root fixtures and test environment.

The env block below must run before anything under ``app.`` is imported.
Several modules read configuration at import time and cannot be reconfigured
afterwards:

    app/lib/database.py   builds ``engine`` from DATABASE_URL
    app/lib/auth.py       reads JWT_SECRET_KEY and ADMIN_USER_EMAILS
    app/lib/toy_images.py constructs AsyncOpenAI clients, which raise if
                          OPENAI_API_KEY is unset

pytest loads this conftest before collecting any test module, so setting the
environment at module scope here is early enough.

Fixtures needing a live Postgres and Redis live in tests/api/conftest.py, which
keeps `pytest tests/unit` runnable with no services at all.
"""

import os
import tempfile
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Points at a database dedicated to tests. Every test runs inside a transaction
# that is rolled back, but the schema itself is created here, so this must never
# be the development database.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://toy_library:toy_library@localhost:5432/toy_library_test",
)

# Redis db 15 rather than 0: the per-test flush would otherwise wipe the
# blocklist and rate-limit keys of a locally running dev stack.
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/15")

_TEST_IMAGE_DIR = tempfile.mkdtemp(prefix="toy-library-test-images-")

os.environ.update(
    {
        "DATABASE_URL": TEST_DATABASE_URL,
        "REDIS_URL": TEST_REDIS_URL,
        "JWT_SECRET_KEY": "test-secret-key-not-used-anywhere-real",
        "ADMIN_USER_EMAILS": "admin@example.com",
        # openai.AsyncOpenAI raises at construction time without a key. Nothing
        # reaches the network: the embedding calls are stubbed in stub_embeddings.
        "OPENAI_API_KEY": "test-key-never-used",
        # A port nothing listens on, so an unstubbed embedding call fails fast
        # instead of reaching whatever happens to be on the developer's LAN.
        "LOCAL_EMBEDDING_BASE_URL": "http://127.0.0.1:1/v1",
        "LIVE_EMAIL": "false",
        # app/routers/auth.py rate-limits the whole router to 10 requests per
        # minute per IP. Every test shares 127.0.0.1, so the production limit
        # would start returning 429s partway through the auth tests.
        "RATE_LIMIT_MAX_REQUESTS": "100000",
        "TOY_IMAGE_STORAGE_DIR": _TEST_IMAGE_DIR,
        "TOY_IMAGE_PUBLIC_PATH": "/images",
    }
)

# app/main.py builds an aggregating Prometheus registry when this is set, which
# needs a writable multiprocess dir. Single-process tests want the default one.
os.environ.pop("PROMETHEUS_MULTIPROC_DIR", None)

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def stub_embeddings(monkeypatch):
    """Replace the two OpenAI-backed calls with deterministic local stand-ins.

    `toy_embedding` also runs as a FastAPI background task, which httpx's
    ASGITransport really does execute after the response — so leaving it
    unstubbed would make toy creation reach out to the network. The names are
    patched on the importing modules too, since the routers bind them at import
    time with `from ... import toy_embedding`.
    """

    async def fake_embed_description(description: str) -> list[float]:
        # Vector(768) on Toy.embedding; the value only needs to be well-formed.
        return [0.0] * 768

    async def fake_toy_embedding(toy_id: int) -> None:
        return None

    for module in ("app.lib.toy_images", "app.routers.toys"):
        monkeypatch.setattr(f"{module}.embed_description", fake_embed_description)
    for module in ("app.lib.toy_images", "app.routers.toys", "app.routers.admin"):
        monkeypatch.setattr(f"{module}.toy_embedding", fake_toy_embedding)


@pytest.fixture
def image_storage_dir(tmp_path, monkeypatch) -> Path:
    """Point image writes at a per-test directory.

    toy_images reads TOY_IMAGE_STORAGE_DIR on every call, so this takes effect
    without reimporting anything.
    """
    storage = tmp_path / "images"
    storage.mkdir()
    monkeypatch.setenv("TOY_IMAGE_STORAGE_DIR", str(storage))
    return storage
