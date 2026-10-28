from __future__ import annotations

import base64
import contextlib
import os
import time
from pathlib import Path
from typing import cast
from urllib.parse import urlsplit
from uuid import uuid4

import anyio
import structlog
from fastapi import HTTPException, UploadFile
from openai import AsyncOpenAI
from pgvector.sqlalchemy import Vector

from app.lib.database import AsyncSessionLocal
from app.models.models import Toy, ToyImage

logger = structlog.get_logger(__name__)

MAX_TOY_IMAGE_BYTES = 10 * 1024 * 1024
MAX_TOY_IMAGES = 3
MAX_EXTERNAL_IMAGE_URL_LENGTH = 2048
TOY_IMAGE_PUBLIC_PATH_ENV = "TOY_IMAGE_PUBLIC_PATH"
TOY_IMAGE_STORAGE_DIR_ENV = "TOY_IMAGE_STORAGE_DIR"
LOCAL_EMBEDDING_BASE_URL_ENV = "LOCAL_EMBEDDING_BASE_URL"

_ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

_ALLOWED_IMAGE_SUFFIXES = {
    ".jpg": ".jpg",
    ".jpeg": ".jpg",
    ".png": ".png",
    ".gif": ".gif",
    ".webp": ".webp",
}


def get_toy_image_storage_dir() -> Path:
    return Path(os.environ.get(TOY_IMAGE_STORAGE_DIR_ENV, "/data/images"))


def get_toy_image_public_path() -> str:
    return os.environ.get(TOY_IMAGE_PUBLIC_PATH_ENV, "/images")


def build_toy_image_public_path(filename: str) -> str:
    prefix = get_toy_image_public_path().rstrip("/")
    return f"{prefix}/{filename}"


def resolve_toy_image_storage_path(public_path: str) -> Path:
    return get_toy_image_storage_dir() / Path(public_path).name


def delete_toy_image(public_path: str | None) -> None:
    if not public_path:
        return
    prefix = get_toy_image_public_path().rstrip("/")
    if not public_path.startswith(f"{prefix}/"):
        return
    with contextlib.suppress(FileNotFoundError):
        resolve_toy_image_storage_path(public_path).unlink()


def _resolve_image_suffix(upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower()
    if content_type in _ALLOWED_IMAGE_MIME_TYPES:
        return _ALLOWED_IMAGE_MIME_TYPES[content_type]

    suffix = Path(upload.filename or "").suffix.lower()
    if suffix in _ALLOWED_IMAGE_SUFFIXES:
        return _ALLOWED_IMAGE_SUFFIXES[suffix]

    raise HTTPException(
        status_code=400,
        detail="Only JPEG, PNG, GIF, and WEBP images are supported.",
    )


def validate_external_image_url(url: str) -> str:
    """Check a user-supplied image link without ever going near it.

    Nothing here makes a request, and nothing downstream does either: an
    external image is only stored, handed to the browser, and passed to OpenAI
    as an `image_url`. Fetching it ourselves would turn this field into an SSRF
    lever, since the backend can reach the embedding server, Postgres and Redis.

    `https` only — `http` leaks the viewer's traffic and, more to the point,
    everything else a URL parser will accept (`javascript:`, `data:`, `file:`)
    is either an injection vector or useless as an image.
    """
    candidate = url.strip()
    if not candidate:
        raise HTTPException(status_code=400, detail="Image link cannot be empty.")
    if len(candidate) > MAX_EXTERNAL_IMAGE_URL_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=(
                "Image links must be "
                f"{MAX_EXTERNAL_IMAGE_URL_LENGTH} characters or fewer."
            ),
        )

    parts = urlsplit(candidate)
    if parts.scheme != "https" or not parts.netloc:
        raise HTTPException(
            status_code=400,
            detail="Image links must be a full https:// URL.",
        )
    return candidate


async def save_toy_image(upload: UploadFile) -> str:
    suffix = _resolve_image_suffix(upload)

    storage_dir = get_toy_image_storage_dir()
    storage_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{suffix}"
    async with await anyio.open_file(storage_dir / filename, "wb") as buffer:
        await buffer.write(await upload.read())
    return build_toy_image_public_path(filename)


OPENAI_MODEL = "gpt-4o"
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"

_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
_local_client = AsyncOpenAI(
    base_url=os.environ.get(
        LOCAL_EMBEDDING_BASE_URL_ENV, "http://192.168.1.113:8080/v1"
    ),
    api_key="None Needed for local",
)


async def _image_content_part(image: ToyImage) -> dict:
    """The `image_url` part of the OpenAI request for one toy image.

    An upload is inlined as base64 because the storage directory is not
    reachable from the internet. An external link is passed through as-is — we
    hand OpenAI the URL and let it do the fetching, which is the whole reason
    this backend never has to.
    """
    if image.external_url is not None:
        return {"type": "image_url", "image_url": {"url": image.external_url}}

    storage_path = resolve_toy_image_storage_path(image.path or "")
    async with await anyio.open_file(storage_path, "rb") as image_file:
        base64_image = base64.b64encode(await image_file.read()).decode("utf-8")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
    }


async def describe_image(image: ToyImage) -> str:
    """
    Passes an image to OpenAI and returns the description generated by the chosen model
    """
    image_part = await _image_content_part(image)

    response = await _client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe this toy in detail. This description will be used to identify the toy in searches later. "
                            "If you know anything about the brand, manufacturer or name of the character the toy is meant to "
                            "portray, please also include that information."
                        ),
                    },
                    image_part,
                ],
            }
        ],
    )
    return response.choices[0].message.content or ""


async def embed_description(description: str) -> list[float]:
    """Generates a vector embedding for a given text string using the local embedding model."""
    start = time.perf_counter()
    response = await _local_client.embeddings.create(
        # llama uses whatever is loaded, so we may as well use the openAI value here.
        model=OPENAI_EMBEDDING_MODEL,
        input=description,
    )
    elapsed = time.perf_counter() - start
    logger.info(
        "local_embedding_request_completed",
        elapsed_seconds=round(elapsed, 3),
    )
    return response.data[0].embedding


async def toy_embedding(
    toy_id: int,
) -> None:
    """
    Generates a description for the toy using OpenAI models
    then vectorizes that description.

    Persists both to the toy model once complete.
    """
    async with AsyncSessionLocal() as db:
        toy = await db.get(Toy, toy_id)
        if toy is None:
            raise ValueError(f"Toy id {toy_id} not found in DB")
        if not toy.images:
            # An image-less toy is a legitimate listing, and the callers only
            # queue this when there is something to describe. Raising here would
            # fail a background task over nothing.
            return

        cover = toy.images[0]
        try:
            description = await describe_image(cover)
        except Exception:
            # An external link can 404, time out, or be something OpenAI refuses
            # to fetch, and none of that is worth crashing a background task
            # over: the toy simply keeps whatever description it already had.
            logger.warning(
                "toy_image_description_failed",
                toy_id=toy_id,
                is_external=cover.is_external,
                exc_info=True,
            )
            return

        vector = await embed_description(
            ". ".join([toy.title, (toy.description or ""), description])
        )
        toy.embedding, toy.ai_description = cast(Vector, vector), description

        await db.commit()
