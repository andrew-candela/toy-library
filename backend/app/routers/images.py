import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, Response
from starlette import status
from app.lib.auth import get_current_user
from app.models.models import User

INTERNAL_IMAGES_NGINX_PATH = "/internal-images/"

router = APIRouter()


@router.get("/{image_path}")
async def get_toy_image(
    image_path: str, current_user: User = Depends(get_current_user)
):
    """
    Returns an empty response and redirects the request back to nginx.
    """
    image_filename = str(Path(image_path).name)
    response = Response(status_code=status.HTTP_200_OK)
    image_redirect_path = INTERNAL_IMAGES_NGINX_PATH + image_filename
    response.headers["X-Accel-Redirect"] = image_redirect_path
    mime_type, _ = mimetypes.guess_type(image_filename)
    if mime_type:
        response.headers["Content-Type"] = mime_type

    return response
