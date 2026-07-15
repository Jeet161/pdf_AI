from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import Response

from app.core.internal_auth import get_current_user_id
from app.services import pdf_tools

router = APIRouter(prefix="/tools", tags=["pdf-tools"])

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB per file


async def _read_validated(file: UploadFile, expected_prefix: str) -> bytes:
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{file.filename}: file is too large (max 20 MB).",
        )
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{file.filename}: file is empty.",
        )
    if expected_prefix and file.content_type and not file.content_type.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{file.filename}: expected a {expected_prefix} file.",
        )
    return content


@router.post("/merge")
async def merge_pdfs_endpoint(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    if len(files) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least 2 PDF files to merge.",
        )

    contents = [await _read_validated(f, "application/pdf") for f in files]

    try:
        merged = pdf_tools.merge_pdfs(contents)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not merge these PDFs. One of them may be corrupted.",
        )

    return Response(
        content=merged,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=merged.pdf"},
    )


@router.post("/split")
async def split_pdf_endpoint(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    content = await _read_validated(file, "application/pdf")

    try:
        zip_bytes = pdf_tools.split_pdf(content)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not split this PDF. It may be corrupted.",
        )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=split-pages.zip"},
    )


@router.post("/images-to-pdf")
async def images_to_pdf_endpoint(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    if len(files) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least 1 image.",
        )

    contents = [await _read_validated(f, "image/") for f in files]

    try:
        pdf_bytes = pdf_tools.images_to_pdf(contents)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not convert these images. One of them may be an unsupported format.",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=images.pdf"},
    )


@router.post("/pdf-to-images")
async def pdf_to_images_endpoint(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    content = await _read_validated(file, "application/pdf")

    try:
        zip_bytes = pdf_tools.pdf_to_images(content)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not convert this PDF to images. It may be corrupted.",
        )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pages.zip"},
    )


@router.post("/compress")
async def compress_file_endpoint(
    file: UploadFile = File(...),
    target_size_kb: int = Form(500),
    user_id: str = Depends(get_current_user_id),
):
    # Detect type by content type or filename
    is_pdf = file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf")
    is_image = (file.content_type and file.content_type.startswith("image/")) or file.filename.lower().endswith((".jpg", ".jpeg", ".png"))
    
    if not is_pdf and not is_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and Image files are supported for compression.",
        )
        
    content = await _read_validated(file, "")

    try:
        if is_pdf:
            compressed_bytes = pdf_tools.compress_pdf(content, target_size_kb=target_size_kb)
            media_type = "application/pdf"
            filename = f"compressed-{file.filename}" if file.filename else "compressed.pdf"
        else:
            compressed_bytes = pdf_tools.compress_image(content, target_size_kb=target_size_kb)
            media_type = "image/jpeg"
            
            # Change extension to jpg if it was something else
            base_name = file.filename.rsplit(".", 1)[0] if file.filename else "image"
            filename = f"compressed-{base_name}.jpg"
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not compress this file. It may be corrupted or unsupported.",
        )

    return Response(
        content=compressed_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
