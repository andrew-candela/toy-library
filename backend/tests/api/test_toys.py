"""Toy listing, filtering, pagination, and CRUD."""

from sqlalchemy import select

from app.models.models import Toy, ToyTag, UserToy
from tests.factories import make_toy, make_user


async def test_listing_requires_authentication(client):
    assert (await client.get("/api/toys/")).status_code == 401


async def test_list_returns_every_toy_with_pagination_metadata(
    auth_client, db_session, user
):
    await make_toy(db_session, owner=user, title="Blocks")
    await make_toy(db_session, owner=user, title="Puzzle")

    body = (await auth_client.get("/api/toys/")).json()

    assert body["total"] == 2
    assert body["page"] == 1
    assert body["total_pages"] == 1
    assert {item["title"] for item in body["items"]} == {"Blocks", "Puzzle"}


async def test_pagination_splits_results_across_pages(auth_client, db_session, user):
    for index in range(5):
        await make_toy(db_session, owner=user, title=f"Toy {index}")

    first = (
        await auth_client.get("/api/toys/", params={"page": 1, "page_size": 2})
    ).json()
    last = (
        await auth_client.get("/api/toys/", params={"page": 3, "page_size": 2})
    ).json()

    assert first["total"] == 5
    assert first["total_pages"] == 3
    assert len(first["items"]) == 2
    assert len(last["items"]) == 1


async def test_pagination_pages_do_not_overlap(auth_client, db_session, user):
    for index in range(4):
        await make_toy(db_session, owner=user, title=f"Toy {index}")

    first = (
        await auth_client.get("/api/toys/", params={"page": 1, "page_size": 2})
    ).json()
    second = (
        await auth_client.get("/api/toys/", params={"page": 2, "page_size": 2})
    ).json()

    first_ids = {item["id"] for item in first["items"]}
    second_ids = {item["id"] for item in second["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_page_size_is_capped(auth_client):
    assert (
        await auth_client.get("/api/toys/", params={"page_size": 500})
    ).status_code == 422


async def test_filter_by_owned_by_current_user(auth_client, db_session, user, other_user):
    await make_toy(db_session, owner=user, title="Mine")
    await make_toy(db_session, owner=other_user, title="Theirs")

    body = (
        await auth_client.get("/api/toys/", params={"owned_by_current_user": True})
    ).json()

    assert [item["title"] for item in body["items"]] == ["Mine"]


async def test_filter_by_owner_username(auth_client, db_session, user, other_user):
    await make_toy(db_session, owner=user, title="Mine")
    await make_toy(db_session, owner=other_user, title="Theirs")

    body = (
        await auth_client.get(
            "/api/toys/", params={"owner_username": other_user.username}
        )
    ).json()

    assert [item["title"] for item in body["items"]] == ["Theirs"]


async def test_filter_by_neighborhood(auth_client, db_session, user):
    northside = await make_user(
        db_session, username="north", neighborhood="Northside"
    )
    southside = await make_user(
        db_session, username="south", neighborhood="Southside"
    )
    await make_toy(db_session, owner=northside, title="North Toy")
    await make_toy(db_session, owner=southside, title="South Toy")

    body = (
        await auth_client.get("/api/toys/", params={"neighborhood": "Northside"})
    ).json()

    assert [item["title"] for item in body["items"]] == ["North Toy"]


async def test_listing_reports_the_owners_neighborhood(auth_client, db_session):
    owner = await make_user(db_session, username="north", neighborhood="Northside")
    await make_toy(db_session, owner=owner, title="North Toy")

    body = (await auth_client.get("/api/toys/")).json()

    assert body["items"][0]["neighborhood"] == "Northside"


async def test_filter_by_age_uses_an_inclusive_range(auth_client, db_session, user):
    await make_toy(db_session, owner=user, title="Toddler", min_age=1, max_age=3)
    await make_toy(db_session, owner=user, title="Big Kid", min_age=8, max_age=12)

    body = (await auth_client.get("/api/toys/", params={"age": 3})).json()

    assert [item["title"] for item in body["items"]] == ["Toddler"]


async def test_age_filter_excludes_toys_with_no_age_range(auth_client, db_session, user):
    await make_toy(db_session, owner=user, title="Unspecified")

    body = (await auth_client.get("/api/toys/", params={"age": 5})).json()

    assert body["total"] == 0


async def test_negative_age_is_rejected(auth_client):
    response = await auth_client.get("/api/toys/", params={"age": -1})

    assert response.status_code == 400


async def test_filter_by_tag(auth_client, db_session, user):
    await make_toy(db_session, owner=user, title="Blocks", tags=["wood"])
    await make_toy(db_session, owner=user, title="Doll", tags=["plastic"])

    body = (await auth_client.get("/api/toys/", params={"tags": ["wood"]})).json()

    assert [item["title"] for item in body["items"]] == ["Blocks"]


async def test_multiple_tags_are_combined_with_and(auth_client, db_session, user):
    await make_toy(db_session, owner=user, title="Both", tags=["wood", "puzzle"])
    await make_toy(db_session, owner=user, title="One", tags=["wood"])

    body = (
        await auth_client.get("/api/toys/", params={"tags": ["wood", "puzzle"]})
    ).json()

    assert [item["title"] for item in body["items"]] == ["Both"]


async def test_tag_filter_normalizes_the_query(auth_client, db_session, user):
    """The UI sends tags with a leading hash and the user's own casing."""
    await make_toy(db_session, owner=user, title="Blocks", tags=["wood"])

    body = (await auth_client.get("/api/toys/", params={"tags": ["#Wood"]})).json()

    assert [item["title"] for item in body["items"]] == ["Blocks"]


async def test_tag_suggestions_match_by_prefix(auth_client, db_session, user):
    await make_toy(db_session, owner=user, tags=["wooden", "woodland", "plastic"])

    suggestions = (await auth_client.get("/api/toys/tags", params={"q": "wood"})).json()

    assert suggestions == ["wooden", "woodland"]


async def test_tag_suggestions_are_empty_for_a_blank_query(auth_client):
    assert (await auth_client.get("/api/toys/tags", params={"q": " "})).json() == []


async def test_get_toy_includes_the_owner_username(auth_client, db_session, other_user):
    toy = await make_toy(db_session, owner=other_user, title="Blocks")

    body = (await auth_client.get(f"/api/toys/{toy.id}")).json()

    assert body["title"] == "Blocks"
    assert body["owner_username"] == other_user.username


async def test_get_missing_toy_returns_404(auth_client):
    assert (await auth_client.get("/api/toys/999999")).status_code == 404


async def test_create_toy_assigns_ownership_to_the_caller(auth_client, db_session, user):
    response = await auth_client.post(
        "/api/toys", data={"title": "New Blocks", "tags": ["#Wood", "Puzzle"]}
    )

    assert response.status_code == 201
    toy_id = response.json()["id"]
    user_toy = (
        await db_session.execute(select(UserToy).where(UserToy.toy_id == toy_id))
    ).scalar_one()
    assert user_toy.user_id == user.id


async def test_create_toy_normalizes_tags(auth_client, db_session):
    response = await auth_client.post(
        "/api/toys", data={"title": "New Blocks", "tags": ["#Wood", "  PUZZLE "]}
    )

    tags = (
        (
            await db_session.execute(
                select(ToyTag.tag).where(ToyTag.toy_id == response.json()["id"])
            )
        )
        .scalars()
        .all()
    )
    assert sorted(tags) == ["puzzle", "wood"]


async def test_create_toy_drops_tags_that_normalize_to_nothing(auth_client, db_session):
    response = await auth_client.post(
        "/api/toys", data={"title": "New Blocks", "tags": ["#", "  ", "wood"]}
    )

    tags = (
        (
            await db_session.execute(
                select(ToyTag.tag).where(ToyTag.toy_id == response.json()["id"])
            )
        )
        .scalars()
        .all()
    )
    assert tags == ["wood"]


async def test_create_toy_rejects_an_inverted_age_range(auth_client):
    response = await auth_client.post(
        "/api/toys", data={"title": "Blocks", "min_age": 8, "max_age": 3}
    )

    assert response.status_code == 400


async def test_create_toy_stores_an_uploaded_image(
    auth_client, db_session, image_storage_dir
):
    response = await auth_client.post(
        "/api/toys",
        data={"title": "Blocks"},
        files={"image_file": ("blocks.png", b"png-bytes", "image/png")},
    )

    assert response.status_code == 201
    assert response.json()["image_path"].startswith("/images/")
    assert len(list(image_storage_dir.iterdir())) == 1


async def test_create_toy_rejects_a_disallowed_image_type(
    auth_client, image_storage_dir
):
    response = await auth_client.post(
        "/api/toys",
        data={"title": "Blocks"},
        files={"image_file": ("payload.svg", b"<svg/>", "image/svg+xml")},
    )

    assert response.status_code == 400
    assert list(image_storage_dir.iterdir()) == []


async def test_update_toy_changes_only_the_fields_supplied(
    auth_client, db_session, user
):
    toy = await make_toy(
        db_session, owner=user, title="Old", description="Original", min_age=2
    )

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"title": "New"})

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "New"
    assert body["description"] == "Original"
    assert body["min_age"] == 2


async def test_update_toy_replaces_the_tag_set(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user, tags=["old", "stale"])

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"tags": ["fresh"]})

    assert response.status_code == 200
    stored = (
        (
            await db_session.execute(
                select(ToyTag.tag).where(ToyTag.toy_id == toy.id)
            )
        )
        .scalars()
        .all()
    )
    assert stored == ["fresh"]


async def test_update_toy_response_reflects_the_new_tags(auth_client, db_session, user):
    toy = await make_toy(db_session, owner=user, tags=["old", "stale"])

    body = (
        await auth_client.put(f"/api/toys/{toy.id}", data={"tags": ["fresh"]})
    ).json()

    assert body["tags"] == ["fresh"]


async def test_update_toy_rejects_an_age_range_inverted_by_the_existing_value(
    auth_client, db_session, user
):
    """Only max_age is sent, but it lands below the min_age already stored."""
    toy = await make_toy(db_session, owner=user, min_age=8, max_age=12)

    response = await auth_client.put(f"/api/toys/{toy.id}", data={"max_age": 3})

    assert response.status_code == 400


async def test_update_toy_removes_the_old_image_file(
    auth_client, db_session, user, image_storage_dir
):
    existing = image_storage_dir / "old.png"
    existing.write_bytes(b"old")
    toy = await make_toy(db_session, owner=user, image_path="/images/old.png")

    await auth_client.put(
        f"/api/toys/{toy.id}",
        files={"image_file": ("new.png", b"new-bytes", "image/png")},
    )

    assert not existing.exists()


async def test_update_toy_can_clear_the_image(
    auth_client, db_session, user, image_storage_dir
):
    existing = image_storage_dir / "old.png"
    existing.write_bytes(b"old")
    toy = await make_toy(db_session, owner=user, image_path="/images/old.png")

    body = (
        await auth_client.put(f"/api/toys/{toy.id}", data={"remove_image": "true"})
    ).json()

    assert body["image_path"] is None
    assert not existing.exists()


async def test_update_missing_toy_returns_404(auth_client):
    assert (
        await auth_client.put("/api/toys/999999", data={"title": "x"})
    ).status_code == 404


async def test_delete_toy_removes_the_row_and_its_ownership(
    auth_client, db_session, user
):
    toy = await make_toy(db_session, owner=user)

    assert (await auth_client.delete(f"/api/toys/{toy.id}")).status_code == 204

    assert (
        await db_session.execute(select(Toy).where(Toy.id == toy.id))
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(UserToy).where(UserToy.toy_id == toy.id))
    ).scalar_one_or_none() is None


async def test_delete_toy_removes_its_image_file(
    auth_client, db_session, user, image_storage_dir
):
    stored = image_storage_dir / "doomed.png"
    stored.write_bytes(b"data")
    toy = await make_toy(db_session, owner=user, image_path="/images/doomed.png")

    await auth_client.delete(f"/api/toys/{toy.id}")

    assert not stored.exists()


async def test_cannot_delete_a_toy_owned_by_someone_else(
    auth_client, db_session, other_user
):
    toy = await make_toy(db_session, owner=other_user)

    response = await auth_client.delete(f"/api/toys/{toy.id}")

    assert response.status_code == 403


async def test_cannot_delete_a_toy_with_a_pending_transfer(
    auth_client, db_session, user, other_user
):
    toy = await make_toy(db_session, owner=user)
    user_toy = (
        await db_session.execute(select(UserToy).where(UserToy.toy_id == toy.id))
    ).scalar_one()
    user_toy.pending_user_id = other_user.id
    await db_session.flush()

    response = await auth_client.delete(f"/api/toys/{toy.id}")

    assert response.status_code == 409


async def test_delete_missing_toy_returns_404(auth_client):
    assert (await auth_client.delete("/api/toys/999999")).status_code == 404
