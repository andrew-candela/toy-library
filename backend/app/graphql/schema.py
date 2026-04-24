from __future__ import annotations

from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from strawberry.permission import BasePermission
from strawberry.types import Info

from app.graphql.context import GraphQLContext
from app.models.models import Item as ItemModel
from app.models.models import Toy as ToyModel
from app.models.models import ToyTag as ToyTagModel
from app.models.models import UserItem as UserItemModel


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
    image_url: Optional[str]
    tags: list[ToyTagType]

    @classmethod
    def from_model(cls, model: ToyModel) -> ToyType:
        return cls(
            id=model.id,
            title=model.title,
            description=model.description,
            age_range=model.age_range,
            image_url=model.image_url,
            tags=[ToyTagType.from_model(t) for t in model.tags],
        )


@strawberry.type
class ItemType:
    id: int
    condition: str
    date_added: datetime
    toy: ToyType

    @classmethod
    def from_model(cls, model: ItemModel) -> ItemType:
        return cls(
            id=model.id,
            condition=model.condition.value,
            date_added=model.date_added,
            toy=ToyType.from_model(model.toy),
        )


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def my_items(self, info: Info[GraphQLContext, None]) -> list[ItemType]:
        db = info.context.db
        current_user = info.context.current_user
        if current_user is None:
            return []

        result = await db.execute(
            select(UserItemModel)
            .where(UserItemModel.user_id == current_user.id)
            .options(
                selectinload(UserItemModel.item)
                .selectinload(ItemModel.toy)
                .selectinload(ToyModel.tags)
            )
        )
        user_items = result.scalars().all()
        return [ItemType.from_model(ui.item) for ui in user_items]


schema = strawberry.Schema(query=Query)
