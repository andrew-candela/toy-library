"""Tag normalization, age-range checks, and schema validators."""

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.toys import _normalize_tag, _validate_age_range
from app.schemas.schemas import ToyCreate, ToyOut, UserContactEmailRequest

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("#Blocks", "blocks"),
        ("  Blocks  ", "blocks"),
        ("##nested", "nested"),
        ("BLOCKS", "blocks"),
        ("", ""),
        ("#", ""),
    ],
)
def test_tag_normalization(raw, expected):
    """Filtering and suggestion both compare against the normalized form, so
    "#Blocks" and "blocks" have to collapse to the same tag."""
    assert _normalize_tag(raw) == expected


@pytest.mark.parametrize(
    "min_age,max_age",
    [(None, None), (0, None), (None, 5), (2, 5), (3, 3)],
)
def test_valid_age_ranges_are_accepted(min_age, max_age):
    _validate_age_range(min_age, max_age)


@pytest.mark.parametrize(
    "min_age,max_age,message",
    [
        (-1, None, "Minimum age must be 0 or greater"),
        (None, -1, "Maximum age must be 0 or greater"),
        (6, 3, "Minimum age must be less than or equal to maximum age"),
    ],
)
def test_invalid_age_ranges_are_rejected(min_age, max_age, message):
    with pytest.raises(HTTPException) as excinfo:
        _validate_age_range(min_age, max_age)

    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == message


def test_toy_create_rejects_an_inverted_age_range():
    with pytest.raises(ValidationError):
        ToyCreate(title="Blocks", min_age=6, max_age=3)


def test_toy_out_coerces_tag_rows_to_strings():
    """The ORM hands ToyOut a list of ToyTag objects, not strings."""

    class FakeTag:
        def __init__(self, tag):
            self.tag = tag

    toy = ToyOut.model_validate(
        {"id": 1, "title": "Blocks", "tags": [FakeTag("wood"), "plastic"]}
    )

    assert toy.tags == ["wood", "plastic"]


def test_toy_out_treats_missing_tags_as_empty():
    assert ToyOut.model_validate({"id": 1, "title": "Blocks", "tags": None}).tags == []


@pytest.mark.parametrize("message", ["", "   ", "hi"])
def test_contact_message_must_be_substantive(message):
    with pytest.raises(ValidationError):
        UserContactEmailRequest(to_username="bob", message=message)


def test_contact_message_is_length_capped():
    with pytest.raises(ValidationError):
        UserContactEmailRequest(to_username="bob", message="x" * 2001)


def test_contact_request_strips_surrounding_whitespace():
    request = UserContactEmailRequest(to_username="  bob  ", message="  hello there  ")

    assert request.to_username == "bob"
    assert request.message == "hello there"
