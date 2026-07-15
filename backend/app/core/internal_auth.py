from fastapi import Header, HTTPException, status

from app.core.config import settings


def get_current_user_id(
    x_internal_secret: str = Header(...),
    x_user_id: str = Header(...),
) -> str:
    """
    FastAPI dependency used on every endpoint that needs to know "who is
    making this request". Trusts the X-User-Id header ONLY if it's
    accompanied by the correct shared secret - proving the request came
    from our Next.js server (which already verified the Better Auth
    session), not from an arbitrary client claiming to be any user.
    """
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal secret.",
        )

    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user id.",
        )

    return x_user_id
