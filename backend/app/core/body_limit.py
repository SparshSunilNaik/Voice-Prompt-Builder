from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    """Bound the raw upload before Starlette's multipart parser spools files."""

    def __init__(self, app, audio_bytes: int):
        self.app = app
        self.audio_bytes = audio_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            return await self.app(scope, receive, send)
        limit = self.audio_bytes + 65536 if scope["path"] == "/api/transcribe" else 131072
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "body_too_large",
                            "message": "The request exceeds the upload limit.",
                        }
                    },
                )
                return await response(scope, receive, send)
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
