from __future__ import annotations

import contextlib
import os
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

MAX_TOY_IMAGE_BYTES = 10 * 1024 * 1024
TOY_IMAGE_PUBLIC_PATH_ENV = "TOY_IMAGE_PUBLIC_PATH"
TOY_IMAGE_STORAGE_DIR_ENV = "TOY_IMAGE_STORAGE_DIR"

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


async def save_toy_image(upload: UploadFile) -> str:
    suffix = _resolve_image_suffix(upload)
    contents = await upload.read()
    if len(contents) > MAX_TOY_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large.")

    storage_dir = get_toy_image_storage_dir()
    storage_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{suffix}"
    with open(storage_dir / filename, "wb") as buffer:
        buffer.write(await upload.read())
    return build_toy_image_public_path(filename)
