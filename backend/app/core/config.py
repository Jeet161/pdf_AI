from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized app configuration.
    Values are loaded from environment variables / a .env file.
    """

    database_url: str = "postgresql+psycopg://ara_user:ara_password@localhost:5432/ara_db"
    gemini_api_key: str = ""
    storage_dir: str = "./storage"

    # Shared secret that only our Next.js server knows. Used to verify that
    # requests claiming "this user is authenticated" really did come from
    # our frontend (which already checked the Better Auth session) and not
    # from someone directly hitting the API pretending to be any user.
    internal_api_secret: str = "change-me-in-env"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


# Import this single instance anywhere you need settings:
# from app.core.config import settings
settings = Settings()
