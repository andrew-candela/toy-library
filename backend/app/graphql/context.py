
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.fastapi import BaseContext

from app.lib.auth import authenticate_token
from app.lib.database import get_db
from app.models.models import User


class GraphQLContext(BaseContext):
    def __init__(self, db: AsyncSession, current_user: User | None):
        super().__init__()
        self.db = db
        self.current_user = current_user


async def get_graphql_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GraphQLContext:
    current_user = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer ") :]
        current_user = await authenticate_token(token, db)
    return GraphQLContext(db=db, current_user=current_user)
