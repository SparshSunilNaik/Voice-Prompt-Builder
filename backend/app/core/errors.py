class AppError(Exception):
    def __init__(self, message: str, *, status_code: int = 500, code: str = "internal_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class ConfigurationError(AppError):
    def __init__(self, service: str):
        super().__init__(f"{service} is not configured", status_code=503, code="not_configured")


class ProviderError(AppError):
    pass
