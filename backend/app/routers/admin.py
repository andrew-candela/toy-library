from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.status import HTTP_200_OK, HTTP_404_NOT_FOUND

from app.lib.auth import get_admin_user
from app.lib.database import get_db
from app.lib.toy_images import toy_embedding
from app.models.models import AllowList, User
from app.schemas.schemas import AllowListDeleteResponse, AllowListResponse

router = APIRouter()


@router.get("/allowlist", response_model=AllowListResponse)
async def list_all_allowed_emails(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)
):
    """
    Fetches all emails that are allowed to use the app
    """
    allowlist_result = await db.execute(select(AllowList))
    return AllowListResponse(
        emails=[element.email for element in allowlist_result.scalars().all()]
    )


@router.post("/allowlist/{email}")
async def add_email_to_allowlist(
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> AllowListResponse:
    """
    Adds an email to the allowlist
    """
    lowered_email = email.lower()
    existing_entry = await db.execute(
        select(AllowList).where(AllowList.email == lowered_email)
    )
    if existing_entry.scalar_one_or_none() is not None:
        return AllowListResponse(
            emails=[
                rec.email
                for rec in (await db.execute(select(AllowList))).scalars().all()
            ]
        )

    new_entry = AllowList(email=lowered_email)
    db.add(new_entry)
    await db.commit()
    return AllowListResponse(
        emails=[
            rec.email for rec in (await db.execute(select(AllowList))).scalars().all()
        ]
    )


@router.delete("/allowlist/{email}", status_code=HTTP_200_OK)
async def remove_email_from_allowlist(
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
) -> AllowListDeleteResponse:
    """
    Removes an email from the allowlist
    """
    lowered_email = email.lower()
    existing_entry = await db.execute(
        select(AllowList).where(AllowList.email == lowered_email)
    )
    entry = existing_entry.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND, detail="Email not found in allowlist"
        )

    await db.delete(entry)
    await db.commit()
    return AllowListDeleteResponse(email=lowered_email)


@router.post("/trigger_embedding")
async def rerun_embedding(
    toy_id: int,
    background_tasks: BackgroundTasks,
    _: User = Depends(get_admin_user),
):
    """
    Reruns the embedding for a given toy
    """
    background_tasks.add_task(toy_embedding, toy_id)
