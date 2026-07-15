import io
import zipfile
import fitz  # PyMuPDF
from PIL import Image


def merge_pdfs(pdf_files: list[bytes]) -> bytes:
    """Merges multiple PDFs into one, in the given order."""
    merged = fitz.open()
    for pdf_bytes in pdf_files:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as src:
            merged.insert_pdf(src)

    output = merged.tobytes()
    merged.close()
    return output


def split_pdf(pdf_bytes: bytes) -> bytes:
    """
    Splits a PDF into one file per page, returned as a zip archive
    (page-1.pdf, page-2.pdf, ...).
    """
    zip_buffer = io.BytesIO()

    with fitz.open(stream=pdf_bytes, filetype="pdf") as src:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for page_number in range(len(src)):
                single_page = fitz.open()
                single_page.insert_pdf(src, from_page=page_number, to_page=page_number)
                zf.writestr(f"page-{page_number + 1}.pdf", single_page.tobytes())
                single_page.close()

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def images_to_pdf(image_files: list[bytes]) -> bytes:
    """Combines images (JPEG/PNG/etc) into a single PDF, one image per page."""
    doc = fitz.open()

    for image_bytes in image_files:
        img_doc = fitz.open(stream=image_bytes, filetype=None)  # auto-detects image type
        rect = img_doc[0].rect
        page = doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(rect, stream=image_bytes)
        img_doc.close()

    output = doc.tobytes()
    doc.close()
    return output


def pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> bytes:
    """Renders each page of a PDF as a PNG image, returned as a zip archive."""
    zip_buffer = io.BytesIO()
    zoom = dpi / 72  # PyMuPDF's default is 72 DPI

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for page_number, page in enumerate(doc):
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
                zf.writestr(f"page-{page_number + 1}.png", pix.tobytes("png"))

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def compress_pdf(pdf_bytes: bytes, target_size_kb: int = 500) -> bytes:
    """Compresses a PDF file using PyMuPDF's save options.
    Note: Exact target size cannot be strictly enforced for PDFs without complex re-encoding.
    We just apply maximum compression (garbage=4, deflate=True).
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    output = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return output


def compress_image(image_bytes: bytes, target_size_kb: int = 500) -> bytes:
    """Compresses an image file (e.g. JPG, PNG) using Pillow to hit a target size in KB."""
    img = Image.open(io.BytesIO(image_bytes))
    
    # Convert to RGB if it has alpha channel, to save as JPEG safely
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
        
    target_size_bytes = target_size_kb * 1024
    
    low_q = 5
    high_q = 95
    best_buffer = None
    
    # Binary search for the highest quality that fits in target size
    for _ in range(7): # Max 7 iterations
        mid_q = (low_q + high_q) // 2
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="JPEG", optimize=True, quality=mid_q)
        size = out_buffer.tell()
        
        if size <= target_size_bytes:
            best_buffer = out_buffer
            low_q = mid_q + 1 # Try for better quality
        else:
            high_q = mid_q - 1 # Need smaller file
            
    # If even quality=5 is too big, just return the lowest quality we tried
    if best_buffer is None:
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="JPEG", optimize=True, quality=5)
        best_buffer = out_buffer
        
    return best_buffer.getvalue()
