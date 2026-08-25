import mimetypes
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Response
from fastapi.responses import FileResponse
from starlette import status

from app.lib.auth import get_current_user
from app.lib.toy_images import resolve_toy_image_storage_path
from app.models.models import User

INTERNAL_IMAGES_NGINX_PATH = "/internal-images/"
USE_NGINX_ACCEL_REDIRECT = (
    os.environ.get("TOY_IMAGE_USE_ACCEL_REDIRECT", "true").lower() == "true"
)

router = APIRouter()


@router.get("/{image_path}")
async def get_toy_image(
    image_path: str, current_user: User = Depends(get_current_user)
):
    """
    Returns an empty response and redirects the request back to nginx.
    """
    image_filename = str(Path(image_path).name)
    mime_type, _ = mimetypes.guess_type(image_filename)
    # Prod environment
    if USE_NGINX_ACCEL_REDIRECT:
        response = Response(status_code=status.HTTP_200_OK)
        image_redirect_path = INTERNAL_IMAGES_NGINX_PATH + image_filename
        response.headers["X-Accel-Redirect"] = image_redirect_path
        if mime_type:
            response.headers["Content-Type"] = mime_type
        return response
    # Local dev - serves files directly from the backend
    storage_path = resolve_toy_image_storage_path(image_filename)
    return FileResponse(storage_path, media_type=mime_type)
