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


from pydantic import BaseModel, Field

class AnalysisResponse(BaseModel):
    summary: str = Field(description="A concise 3-5 sentence summary of the document")
    main_points: list[str] = Field(description="A list of 4-8 short strings, each one key point")

def analyze_document(text: str) -> dict:
    """
    Sends the document's extracted text to Gemini once, and asks for both
    a short summary AND a list of main points in a single call - saving
    quota compared to two separate requests.
    """
    client = get_client()
    truncated = text[:MAX_INPUT_CHARS]

    prompt = (
        "You are analyzing a document for a research assistant tool. "
        "Given the document text below, analyze and extract the summary and main points.\n\n"
        f"Document text:\n{truncated}"
    )

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AnalysisResponse,
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
    Answers a question about a document using the provided context chunks
    (retrieved via similarity search - see services/embeddings.py).
    If the document contains questions (e.g. a question paper) without
    answers, the AI will solve them using its own knowledge.
    """
    client = get_client()
    context = "\n\n---\n\n".join(context_chunks)

    prompt = (
        "You are a highly capable AI research assistant. You have been given "
        "context extracted from a document uploaded by the user.\n\n"
        "Your job:\n"
        "1. If the user's question can be answered using the document context, "
        "use it as your primary reference and answer accurately.\n"
        "2. If the document context contains QUESTIONS (e.g. it is a question "
        "paper, exam sheet, or problem set) but does NOT contain the answers, "
        "then USE YOUR OWN KNOWLEDGE to solve and answer those questions "
        "thoroughly. Do not say 'the document does not contain the answer' — "
        "instead, treat the document questions as problems to be solved.\n"
        "3. If the user asks you to 'solve it', 'answer the questions', or "
        "similar, identify all questions in the context and provide complete, "
        "well-explained answers using your knowledge.\n"
        "4. Always be helpful, clear, and detailed in your responses.\n\n"
        f"Document Context:\n{context}\n\n"
        f"User Question: {question}"
    )

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2),
    )
    return response.text
