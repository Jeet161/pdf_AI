import json
from google import genai
from google.genai import types

from app.core.config import settings

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Lazily creates the Gemini client so a missing API key only breaks
    things when Gemini is actually used, not on server startup."""
    global _client
    if _client is None:
        if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Get a free key at "
                "https://aistudio.google.com/apikey and add it to backend/.env"
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


TEXT_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768  # must match Vector(768) in models/document_chunk.py

# Gemini's context window is large, but free-tier quota and cost are best
# respected by capping how much raw document text we send per request.
MAX_INPUT_CHARS = 30000


def analyze_document(text: str) -> dict:
    """
    Sends the document's extracted text to Gemini once, and asks for both
    a short summary AND a list of main points in a single call - saving
    quota compared to two separate requests.

    Returns {"summary": str, "main_points": list[str]}
    """
    client = get_client()
    truncated = text[:MAX_INPUT_CHARS]

    prompt = (
        "You are analyzing a document for a research assistant tool. "
        "Given the document text below, respond with ONLY a JSON object "
        "(no markdown, no code fences) with exactly these two keys:\n"
        '- "summary": a concise 3-5 sentence summary of the document\n'
        '- "main_points": a list of 4-8 short strings, each one key point\n\n'
        f"Document text:\n{truncated}"
    )

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    result = json.loads(response.text)
    return {
        "summary": result.get("summary", ""),
        "main_points": result.get("main_points", []),
    }


def embed_text(text: str) -> list[float]:
    """Returns a 768-dimension embedding vector for a chunk of text."""
    client = get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
    )
    return result.embeddings[0].values


def answer_question(question: str, context_chunks: list[str]) -> str:
    """
    Answers a question about a document using only the provided context
    chunks (retrieved via similarity search - see services/embeddings.py).
    """
    client = get_client()
    context = "\n\n---\n\n".join(context_chunks)

    prompt = (
        "You are a helpful research assistant answering questions about a "
        "document. Use ONLY the context below to answer. If the answer "
        "isn't in the context, say you don't know based on the document.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}"
    )

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2),
    )
    return response.text
