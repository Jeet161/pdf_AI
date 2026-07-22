import fitz  # PyMuPDF
import io
import logging
import re
import time
from typing import Callable, Optional
from PIL import Image
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-3.6-flash"
FALLBACK_MODEL_2 = "gemini-2.5-flash-lite"


def extract_text(
    pdf_bytes: bytes,
    progress_callback: Optional[Callable[[str], None]] = None
) -> str:
    """
    Step 1: Called at upload time / background OCR.
    - Digital PDFs → PyMuPDF extracts text instantly.
    - Scanned/photo PDFs → Gemini Vision OCR using fast 90 DPI JPEGs (~30KB per page).
    - `progress_callback` allows saving partial text to DB after each page batch completes.
    """
    text_parts: list[str] = []
    image_pages: list[tuple[int, bytes]] = []

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        total_pages = len(doc)
        total_digital_chars = 0
        raw_page_texts: list[tuple[int, str]] = []

        for page_index, page in enumerate(doc):
            page_text = page.get_text().strip()
            raw_page_texts.append((page_index, page_text))
            total_digital_chars += len(page_text)

        # If average digital text per page is under 40 characters, treat the whole document as scanned/photo PDF
        avg_chars_per_page = total_digital_chars / max(1, total_pages)
        is_mostly_scanned = avg_chars_per_page < 40

        for page_index, page in enumerate(doc):
            page_text = raw_page_texts[page_index][1]
            if len(page_text) > 40 and not is_mostly_scanned:
                text_parts.append(f"--- PAGE {page_index + 1} ---\n" + page_text)
            else:
                # Render page at 90 DPI with 55% JPEG quality (~30KB per image)
                pix = page.get_pixmap(dpi=90)
                jpeg_bytes = pix.tobytes("jpeg", jpg_quality=55)
                image_pages.append((page_index, jpeg_bytes))

    if text_parts and progress_callback:
        progress_callback("\n\n".join([t for t in text_parts if t.strip()]))

    if image_pages:
        logger.info(f"Scanned PDF: {len(image_pages)} image pages, running Gemini Vision OCR...")
        ocr_results = _ocr_pages(image_pages, text_parts, progress_callback)
        text_parts.extend(ocr_results)

    final_text = "\n\n".join([t for t in text_parts if t.strip()])
    logger.info(f"extract_text finished: {len(final_text)} characters extracted")
    return final_text


def _ocr_pages(
    image_pages: list[tuple[int, bytes]],
    initial_text_parts: list[str],
    progress_callback: Optional[Callable[[str], None]] = None
) -> list[str]:
    """
    Sends scanned pages to Gemini Vision OCR in 2-page batches.
    When 429 rate limit is hit, parses Google's retryDelay and waits out the reset window before retrying.
    """
    from app.core.config import settings

    if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":
        logger.warning("OCR skipped: GEMINI_API_KEY not set")
        return []

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
    except Exception as e:
        logger.error(f"Gemini client init failed: {e}")
        return []

    results: list[str] = []
    chunk_size = 2
    chunks = [image_pages[i:i + chunk_size] for i in range(0, len(image_pages), chunk_size)]

    for chunk_idx, chunk in enumerate(chunks):
        if chunk_idx > 0:
            time.sleep(2.0)  # Pacing pause between requests

        contents: list = []
        page_nums = [p + 1 for p, _ in chunk]
        for _, jpg_bytes in chunk:
            contents.append(Image.open(io.BytesIO(jpg_bytes)))

        contents.append(
            f"These are scanned pages ({page_nums}) from a document/exam paper. "
            "Transcribe ALL visible text, questions, numbers, math equations (using Markdown LaTeX like $x^2$), "
            "and options accurately. Preserve non-English scripts (like Assamese/Bengali) exactly. "
            "Separate pages with '--- PAGE X ---'."
        )

        batch_success = False
        models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL, FALLBACK_MODEL_2]

        for model_name in models_to_try:
            if batch_success:
                break

            max_attempts = 4
            for attempt in range(max_attempts):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=types.GenerateContentConfig(temperature=0.0),
                    )
                    if response.text and response.text.strip():
                        batch_text = response.text.strip()
                        results.append(batch_text)
                        batch_success = True
                        logger.info(f"OCR batch {chunk_idx + 1}/{len(chunks)} (pages {page_nums}) succeeded with {model_name}: {len(batch_text)} chars")

                        # Save incremental text progress immediately to DB
                        if progress_callback:
                            current_all = "\n\n".join([t for t in (initial_text_parts + results) if t.strip()])
                            try:
                                progress_callback(current_all)
                            except Exception as pe:
                                logger.warning(f"Progress callback error: {pe}")

                    break
                except Exception as exc:
                    err_str = str(exc)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        if attempt < max_attempts - 1:
                            delay_match = re.search(r"retry in ([\d.]+)s", err_str, re.IGNORECASE)
                            if not delay_match:
                                delay_match = re.search(r"retryDelay': '(\d+)s'", err_str, re.IGNORECASE)
                            
                            wait_seconds = float(delay_match.group(1)) + 2.0 if delay_match else 25.0
                            logger.warning(
                                f"OCR 429 on batch {chunk_idx + 1}/{len(chunks)} ({model_name}). "
                                f"Waiting {wait_seconds:.1f}s for quota reset (attempt {attempt + 1}/{max_attempts})..."
                            )
                            time.sleep(wait_seconds)
                        else:
                            logger.warning(f"Batch {chunk_idx + 1} exhausted retries on {model_name}, trying fallback model...")
                    else:
                        logger.error(f"OCR batch {chunk_idx + 1} error on {model_name}: {exc}")
                        break

    return results
