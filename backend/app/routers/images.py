from fastapi import APIRouter, Depends, Response
from starlette import status
from app.lib.auth import get_current_user
from app.lib.toy_images import resolve_toy_image_storage_path
from app.models.models import User


router = APIRouter()

@router.get("/{image_path}")
async def get_toy_image(
    image_path: str,
    current_user: User = Depends(get_current_user)
)
    """
    Returns an empty response and redirects the request back to nginx.
    """
    response = Response(status_code=status.HTTP_200_OK)
    response.headers["X-Accel-Redirect"] = image_path

    return response