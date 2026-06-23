from __future__ import annotations

from typing import Optional

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
    description: Optional[str]
    age_range: Optional[str]
    image_path: Optional[str]
    tags: list[ToyTagType]

    @classmethod
    def from_model(cls, model: ToyModel) -> ToyType:
        return cls(
            id=model.id,
            title=model.title,
            description=model.description,
            age_range=model.age_range,
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
            .where(UserToyModel.user_id == current_user.id)
            .options(selectinload(UserToyModel.toy).selectinload(ToyModel.tags))
        )
        user_toys = result.scalars().all()
        return [ToyType.from_model(ut.toy) for ut in user_toys]


schema = strawberry.Schema(query=Query)
