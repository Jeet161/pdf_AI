from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import documents, pdf_tools

app = FastAPI(title="AI Research Assistant API")

# Allow the Next.js frontend (running on localhost:3000 during development)
# to make requests to this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(pdf_tools.router)


@app.get("/health")
def health_check():
    """Simple endpoint to confirm the backend is alive and reachable."""
    return {"status": "ok", "service": "ai-research-assistant-backend"}
