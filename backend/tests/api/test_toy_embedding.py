"""The background task that describes a toy's cover image and embeds it.

The root conftest stubs `toy_embedding` out of the routers; these tests drive
the real function, bound here at import time before that stub is applied, with
its database session pointed at the test's rolled-back one and OpenAI faked.
"""

import pytest
from sqlalchemy import select

from app.lib import toy_images
from app.lib.toy_images import toy_embedding as real_toy_embedding
from app.models.models import Toy
from tests.factories import make_toy


class _SessionProxy:
    """Stands in for AsyncSessionLocal() without closing the shared session."""

    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc_info):
        return False


@pytest.fixture
def task_session(db_session, monkeypatch):
    monkeypatch.setattr(
        toy_images, "AsyncSessionLocal", lambda: _SessionProxy(db_session)
    )
    return db_session


@pytest.fixture
def described_images(monkeypatch) -> list:
    """Records each image handed to describe_image, and answers for it."""
    seen: list = []

    async def fake_describe(image):
        seen.append(image)
        return "a red wooden train"

    monkeypatch.setattr(toy_images, "describe_image", fake_describe)
    return seen


async def _reload(db_session, toy_id: int) -> Toy:
    return (
        await db_session.execute(
            select(Toy)
            .where(Toy.id == toy_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


async def test_describes_only_the_cover_image(task_session, user, described_images):
    toy = await make_toy(
        task_session,
        owner=user,
        images=["https://cdn.example.com/cover.jpg", "/images/second.png"],
    )

    await real_toy_embedding(toy.id)

    assert [image.src for image in described_images] == [
        "https://cdn.example.com/cover.jpg"
    ]
    reloaded = await _reload(task_session, toy.id)
    assert reloaded.ai_description == "a red wooden train"
    assert reloaded.embedding is not None


async def test_a_toy_without_images_is_left_alone(task_session, user, described_images):
    toy = await make_toy(task_session, owner=user)

    await real_toy_embedding(toy.id)

    assert described_images == []
    assert (await _reload(task_session, toy.id)).ai_description is None


async def test_a_broken_external_cover_does_not_crash_the_task(
    task_session, user, monkeypatch
):
    async def openai_refuses(image):
        raise RuntimeError("OpenAI could not download the image")

    monkeypatch.setattr(toy_images, "describe_image", openai_refuses)
    toy = await make_toy(
        task_session, owner=user, images=["https://cdn.example.com/gone.jpg"]
    )

    await real_toy_embedding(toy.id)

    assert (await _reload(task_session, toy.id)).ai_description is None
