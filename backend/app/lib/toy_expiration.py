"""When a listing goes quiet, and who can still see it.

A toy expires after a month of inactivity, where inactivity means two things at
once: nobody currently wants it, and its owner has not touched it. Either signal
on its own keeps it listed, which is why `toys` carries both clocks.

Expiry is derived at read time, never stored. There is no `expired` column to
set and no sweep to run, so a toy comes back the instant somebody expresses
interest or its owner hits Refresh, and the answer is never stale by however
long it has been since the last job ran.

The interest half deliberately reads live `toy_interests` rows rather than
`toys.last_interest_at`: a toy somebody is asking about right now should not
expire out from under them, no matter how long ago they asked. That leaves
`last_interest_at` recording when interest was last *shown*, which is a
different question and not the one this module answers.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, and_, or_, select

from app.models.models import Toy, ToyInterest, UserToy

INACTIVITY_WINDOW = timedelta(days=30)

# How long before the deadline the owner starts being nudged to refresh. Only
# ever affects what the owner is shown — an expiring toy is still fully visible.
EXPIRY_WARNING_WINDOW = timedelta(days=7)


def _has_live_interest() -> ColumnElement[bool]:
    """Correlated against whatever query embeds it, so it stays a subquery."""
    return select(ToyInterest.id).where(ToyInterest.toy_id == Toy.id).exists()


def is_expired_clause(now: datetime) -> ColumnElement[bool]:
    """SQL for "this toy has gone quiet".

    A null `last_owner_activity_at` counts as expired rather than as never
    expiring. The column is backfilled from `date_added`, which is itself
    nullable, so null means "no owner activity has ever been recorded" — and
    treating that as immortal would exempt exactly those listings from the
    feature permanently. Owners keep seeing their own toys either way, so the
    cost of being wrong here is one click on Refresh.
    """
    return and_(
        ~_has_live_interest(),
        or_(
            Toy.last_owner_activity_at.is_(None),
            Toy.last_owner_activity_at < now - INACTIVITY_WINDOW,
        ),
    )


def discoverable_clause(viewer_id: int, now: datetime) -> ColumnElement[bool]:
    """SQL for "this viewer may find this toy".

    Owners are exempt: an expired listing is still theirs to see, edit, and
    refresh. Every catalog read path has to say this, the same way they all
    already say `deleted_at IS NULL` — the two guards are independent, and this
    one does not imply the other.
    """
    return or_(
        ~is_expired_clause(now),
        Toy.id.in_(
            select(UserToy.toy_id).where(
                UserToy.user_id == viewer_id,
                UserToy.released_at.is_(None),
            )
        ),
    )


def expires_at(toy: Toy, *, has_live_interest: bool) -> datetime | None:
    """The deadline to show the owner, or None when there is none to show.

    None covers both "the clock is not running" (somebody is interested) and
    "there is nothing to count from" (no recorded owner activity). Neither is a
    date, so callers pair this with `is_expired` rather than reading a missing
    deadline as reassurance.
    """
    if has_live_interest or toy.last_owner_activity_at is None:
        return None
    return toy.last_owner_activity_at + INACTIVITY_WINDOW


def is_expired(
    toy: Toy, *, has_live_interest: bool, now: datetime | None = None
) -> bool:
    """The Python-side twin of `is_expired_clause`, for serializing a loaded row.

    Kept beside the SQL rather than derived from it so the two can be read
    against each other; `test_toy_expiration` pins them to the same answer.
    """
    if has_live_interest:
        return False
    if toy.last_owner_activity_at is None:
        return True
    return (
        toy.last_owner_activity_at < (now or datetime.now(tz=UTC)) - INACTIVITY_WINDOW
    )
