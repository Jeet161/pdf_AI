from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import documents, pdf_tools

app = FastAPI(title="AI Research Assistant API")

# Allow both local development and the deployed Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pdf-ai-iota.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(pdf_tools.router)


@app.get("/")
def root():
    return {
        "message": "AI Research Assistant API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check():
    """Simple endpoint to confirm the backend is alive and reachable."""
    return {"status": "ok", "service": "ai-research-assistant-backend"}