"""Image path construction, suffix validation, and deletion guards."""

import io

import pytest
from fastapi import HTTPException, UploadFile

from app.lib import toy_images

pytestmark = pytest.mark.unit


def upload(filename: str | None, content_type: str | None, data: bytes = b"bytes"):
    return UploadFile(
        filename=filename,
        file=io.BytesIO(data),
        headers={"content-type": content_type} if content_type else None,
    )


@pytest.mark.parametrize(
    "content_type,expected",
    [
        ("image/jpeg", ".jpg"),
        ("image/png", ".png"),
        ("image/gif", ".gif"),
        ("image/webp", ".webp"),
        ("IMAGE/PNG", ".png"),
    ],
)
def test_suffix_comes_from_the_content_type(content_type, expected):
    assert toy_images._resolve_image_suffix(upload("x", content_type)) == expected


def test_suffix_falls_back_to_the_filename_when_content_type_is_unhelpful():
    """Browsers sometimes send application/octet-stream for a perfectly good file."""
    assert (
        toy_images._resolve_image_suffix(
            upload("photo.JPEG", "application/octet-stream")
        )
        == ".jpg"
    )


def test_unsupported_type_is_rejected():
    with pytest.raises(HTTPException) as excinfo:
        toy_images._resolve_image_suffix(upload("virus.svg", "image/svg+xml"))

    assert excinfo.value.status_code == 400


def test_public_path_is_built_from_the_configured_prefix(monkeypatch):
    monkeypatch.setenv(toy_images.TOY_IMAGE_PUBLIC_PATH_ENV, "/images/")

    assert toy_images.build_toy_image_public_path("abc.jpg") == "/images/abc.jpg"


def test_storage_path_resolution_ignores_directory_components(monkeypatch, tmp_path):
    """A public path is only ever trusted for its basename, so a traversal
    attempt cannot escape the storage directory."""
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path))

    resolved = toy_images.resolve_toy_image_storage_path("/images/../../etc/passwd")

    assert resolved == tmp_path / "passwd"


async def test_save_toy_image_writes_the_bytes_and_returns_a_public_path(
    monkeypatch, tmp_path
):
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path / "images"))
    monkeypatch.setenv(toy_images.TOY_IMAGE_PUBLIC_PATH_ENV, "/images")

    public_path = await toy_images.save_toy_image(
        upload("train.png", "image/png", b"png-bytes")
    )

    assert public_path.startswith("/images/")
    assert public_path.endswith(".png")
    written = toy_images.resolve_toy_image_storage_path(public_path)
    assert written.read_bytes() == b"png-bytes"


async def test_saved_filenames_do_not_collide(monkeypatch, tmp_path):
    """Two uploads of the same filename must not overwrite each other."""
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path / "images"))

    first = await toy_images.save_toy_image(upload("train.png", "image/png"))
    second = await toy_images.save_toy_image(upload("train.png", "image/png"))

    assert first != second


def test_delete_ignores_paths_outside_the_public_prefix(monkeypatch, tmp_path):
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path))
    monkeypatch.setenv(toy_images.TOY_IMAGE_PUBLIC_PATH_ENV, "/images")
    bystander = tmp_path / "keep-me.jpg"
    bystander.write_bytes(b"data")

    toy_images.delete_toy_image("/uploads/keep-me.jpg")

    assert bystander.exists()


def test_delete_removes_a_stored_image(monkeypatch, tmp_path):
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path))
    monkeypatch.setenv(toy_images.TOY_IMAGE_PUBLIC_PATH_ENV, "/images")
    stored = tmp_path / "gone.jpg"
    stored.write_bytes(b"data")

    toy_images.delete_toy_image("/images/gone.jpg")

    assert not stored.exists()


def test_delete_tolerates_none_and_missing_files(monkeypatch, tmp_path):
    """Toy deletion calls this unconditionally, including for toys with no image."""
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path))
    monkeypatch.setenv(toy_images.TOY_IMAGE_PUBLIC_PATH_ENV, "/images")

    toy_images.delete_toy_image(None)
    toy_images.delete_toy_image("/images/never-existed.jpg")
