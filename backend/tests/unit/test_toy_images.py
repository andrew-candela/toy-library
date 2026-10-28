"""Image path construction, suffix and link validation, deletion guards, and
what gets sent to OpenAI for each kind of image."""

import base64
import io

import pytest
from fastapi import HTTPException, UploadFile

from app.lib import toy_images
from app.models.models import ToyImage

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


@pytest.mark.parametrize(
    "url",
    [
        "https://cdn.example.com/blocks.jpg",
        "  https://cdn.example.com/blocks.jpg  ",
        "https://cdn.example.com/a.jpg?w=400#frag",
    ],
)
def test_external_image_url_accepts_https_links(url):
    assert toy_images.validate_external_image_url(url) == url.strip()


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "http://cdn.example.com/blocks.jpg",
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "file:///etc/passwd",
        "https://",
        "https:///blocks.jpg",
        "//cdn.example.com/blocks.jpg",
        "https://cdn.example.com/" + "a" * 2048,
    ],
)
def test_external_image_url_rejects_anything_else(url):
    with pytest.raises(HTTPException) as excinfo:
        toy_images.validate_external_image_url(url)

    assert excinfo.value.status_code == 400


class _FakeCompletions:
    def __init__(self):
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        message = type("Message", (), {"content": "a red wooden train"})()
        choice = type("Choice", (), {"message": message})()
        return type("Response", (), {"choices": [choice]})()


@pytest.fixture
def fake_openai(monkeypatch):
    completions = _FakeCompletions()
    chat = type("Chat", (), {"completions": completions})()
    monkeypatch.setattr(toy_images, "_client", type("Client", (), {"chat": chat})())
    return completions


def _image_part(call: dict) -> dict:
    return call["messages"][0]["content"][1]


async def test_describe_image_passes_an_external_link_straight_to_openai(
    fake_openai, monkeypatch
):
    """The backend must never fetch a user-supplied URL itself — that is the
    SSRF hole this whole design avoids — so the link goes to OpenAI untouched."""

    def no_file_access(*args, **kwargs):
        raise AssertionError("an external image must not be read or fetched")

    monkeypatch.setattr(toy_images.anyio, "open_file", no_file_access)
    image = ToyImage(external_url="https://cdn.example.com/train.jpg", position=0)

    description = await toy_images.describe_image(image)

    assert description == "a red wooden train"
    assert _image_part(fake_openai.calls[0]) == {
        "type": "image_url",
        "image_url": {"url": "https://cdn.example.com/train.jpg"},
    }


async def test_describe_image_inlines_an_upload_as_base64(
    fake_openai, monkeypatch, tmp_path
):
    monkeypatch.setenv(toy_images.TOY_IMAGE_STORAGE_DIR_ENV, str(tmp_path))
    (tmp_path / "train.jpg").write_bytes(b"jpeg-bytes")
    image = ToyImage(path="/images/train.jpg", position=0)

    await toy_images.describe_image(image)

    url = _image_part(fake_openai.calls[0])["image_url"]["url"]
    assert url == "data:image/jpeg;base64," + base64.b64encode(b"jpeg-bytes").decode()
