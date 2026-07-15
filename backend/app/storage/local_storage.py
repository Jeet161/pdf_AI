import uuid
from pathlib import Path

from app.core.config import settings


def save_pdf(owner_id: str, original_filename: str, content: bytes) -> tuple[str, int]:
    """
    Saves PDF bytes to disk under storage/<owner_id>/<uuid>.pdf and
    returns (storage_path, file_size_bytes).

    Files are namespaced by owner_id so users' files never collide.
    """
    owner_dir = Path(settings.storage_dir) / owner_id
    owner_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4()}.pdf"
    file_path = owner_dir / safe_name

    file_path.write_bytes(content)

    return str(file_path), len(content)


def read_pdf(storage_path: str) -> bytes:
    """Reads a previously saved PDF back from disk."""
    return Path(storage_path).read_bytes()
