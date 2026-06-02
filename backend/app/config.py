import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-chat")
    AZURE_OPENAI_API_VERSION: str = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-12-01-preview"
    )

    # Secondary model for comparison
    AZURE_OPENAI_ENDPOINT_ALT: str = os.getenv("AZURE_OPENAI_ENDPOINT_ALT", "")
    AZURE_OPENAI_DEPLOYMENT_ALT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_ALT", "gpt-4.1")

    AZURE_DOCINTEL_ENDPOINT: str = os.getenv("AZURE_DOCINTEL_ENDPOINT", "")
    AZURE_DOCINTEL_KEY: str = os.getenv("AZURE_DOCINTEL_KEY", "")

    # Content Understanding (CU) for floor plan OCR
    AZURE_CU_ENDPOINT: str = os.getenv(
        "AZURE_CU_ENDPOINT",
        "https://mf-multi-agent-project-resource.cognitiveservices.azure.com",
    )
    AZURE_CU_ANALYZER: str = os.getenv("AZURE_CU_ANALYZER", "floorplan-analyzer-v4")
    AZURE_CU_API_VERSION: str = os.getenv("AZURE_CU_API_VERSION", "2025-05-01-preview")

    DATAGOVSG_API_KEY: str = os.getenv("DATAGOVSG_API_KEY", "")

    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")


settings = Settings()
