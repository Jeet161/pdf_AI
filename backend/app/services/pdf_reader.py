import fitz  # PyMuPDF


def extract_text(pdf_bytes: bytes) -> str:
    """
    Extracts all readable text from a PDF, page by page, joined with
    double newlines so paragraphs/pages stay visually separated.

    Returns an empty string if the PDF has no extractable text (e.g. a
    scanned image-only PDF) - it won't raise in that case, since "no
    text found" is a valid, expected outcome, not an error.
    """
    text_parts: list[str] = []

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            page_text = page.get_text().strip()
            if page_text:
                text_parts.append(page_text)

    return "\n\n".join(text_parts)
