from __future__ import annotations

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from strawberry.permission import BasePermission
from strawberry.types import Info

from app.graphql.context import GraphQLContext
from app.models.models import Toy as ToyModel
from app.models.models import ToyTag as ToyTagModel
from app.models.models import UserToy as UserToyModel


class IsAuthenticated(BasePermission):
    message = "User is not authenticated"

    def has_permission(
        self, source: object, info: Info[GraphQLContext, None], **kwargs: object
    ) -> bool:
        return info.context.current_user is not None


@strawberry.type
class ToyTagType:
    id: int
    tag: str

    @classmethod
    def from_model(cls, model: ToyTagModel) -> ToyTagType:
        return cls(id=model.id, tag=model.tag)


@strawberry.type
class ToyType:
    id: int
    title: str
    description: str | None
    min_age: int | None
    max_age: int | None
    image_path: str | None
    tags: list[ToyTagType]

    @classmethod
    def from_model(cls, model: ToyModel) -> ToyType:
        return cls(
            id=model.id,
            title=model.title,
            description=model.description,
            min_age=model.min_age,
            max_age=model.max_age,
            image_path=model.image_path,
            tags=[ToyTagType.from_model(t) for t in model.tags],
        )


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def my_toys(self, info: Info[GraphQLContext, None]) -> list[ToyType]:
        db = info.context.db
        current_user = info.context.current_user
        if current_user is None:
            return []

        result = await db.execute(
            select(UserToyModel)
            # selectinload fetches the toy row whatever its deleted_at says, so
            # the join is what keeps delisted toys out of this list.
            .join(ToyModel, ToyModel.id == UserToyModel.toy_id)
            .where(
                UserToyModel.user_id == current_user.id,
                UserToyModel.released_at.is_(None),
                ToyModel.deleted_at.is_(None),
            )
            .options(selectinload(UserToyModel.toy).selectinload(ToyModel.tags))
        )
        user_toys = result.scalars().all()
        return [ToyType.from_model(ut.toy) for ut in user_toys]


schema = strawberry.Schema(query=Query)
