"""Explicit process configuration; never discover credentials or load other .env files."""
import importlib.util
import os
from urllib.parse import urlparse


class Settings:
    AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT', '')
    AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY', '')
    AZURE_OPENAI_AD_TOKEN = os.getenv('AZURE_OPENAI_AD_TOKEN', '')
    AZURE_OPENAI_AUTH_MODE = os.getenv('AZURE_OPENAI_AUTH_MODE', 'key')
    AZURE_OPENAI_DEPLOYMENT = os.getenv('AZURE_OPENAI_DEPLOYMENT', '')
    AZURE_OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview')
    AZURE_OPENAI_ENDPOINT_ALT = os.getenv('AZURE_OPENAI_ENDPOINT_ALT', '')
    AZURE_OPENAI_DEPLOYMENT_ALT = os.getenv('AZURE_OPENAI_DEPLOYMENT_ALT', '')
    AZURE_CU_ENDPOINT = os.getenv('AZURE_CU_ENDPOINT', '')
    AZURE_CU_API_KEY = os.getenv('AZURE_CU_API_KEY', '')
    AZURE_CU_ANALYZER = os.getenv('AZURE_CU_ANALYZER', '')
    AZURE_CU_API_VERSION = os.getenv('AZURE_CU_API_VERSION', '2025-05-01-preview')
    DATAGOVSG_API_KEY = os.getenv('DATAGOVSG_API_KEY', '')
    CORS_ORIGINS = [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if s.strip()]


settings = Settings()


def extraction_readiness(endpoint=None, deployment=None):
    """Configuration readiness only: never acquires credentials or calls the network."""
    ep = settings.AZURE_OPENAI_ENDPOINT if endpoint is None else endpoint
    dep = settings.AZURE_OPENAI_DEPLOYMENT if deployment is None else deployment
    reason = None
    parsed = urlparse(ep)
    if not ep or parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
        reason = 'Configure AZURE_OPENAI_ENDPOINT as your Azure resource HTTPS URL.'
    elif not dep:
        reason = 'Configure AZURE_OPENAI_DEPLOYMENT with a vision-capable deployment.'
    elif not (settings.AZURE_OPENAI_API_KEY or settings.AZURE_OPENAI_AD_TOKEN):
        if settings.AZURE_OPENAI_AUTH_MODE != 'entra':
            reason = 'Supply AZURE_OPENAI_API_KEY / AZURE_OPENAI_AD_TOKEN, or explicitly enable entra auth.'
        else:
            try:
                available = importlib.util.find_spec('azure.identity') is not None
            except ModuleNotFoundError:
                available = False
            if not available:
                reason = 'Entra auth requires optional azure-identity.'
    return {'extraction_available': reason is None, 'extraction_unavailable_reason': reason,
            'readiness_scope': 'configuration_only_not_live_auth_or_model_probe',
            'models': [dep] if reason is None else []}
