from app.config import get_settings
from app.services.gnani import GnaniClient
from app.services.openrouter import OpenRouterClient


def get_gnani() -> GnaniClient:
    return GnaniClient(get_settings())


def get_openrouter() -> OpenRouterClient:
    return OpenRouterClient(get_settings())
