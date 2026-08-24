"""One JSON shape for every failure, and the handlers that produce it.

The browser client reads ``{"error": "<sentence>"}`` off any non-OK response
and shows that sentence to the user, so a handler that answers in some other
shape reaches the reader as an unparsed blob. FastAPI's defaults are two such
shapes — ``{"detail": "..."}`` for ``HTTPException`` and ``{"detail": [ ... ]}``
for request validation — so both are translated here rather than at the call
sites.

``detail`` is emitted alongside ``error`` because it costs nothing and the
FastAPI convention is what a future non-browser caller will reach for first.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

GENERIC_MESSAGE = "Something went wrong. Please try again."


def error_response(message: str, status_code: int, headers: dict | None = None) -> JSONResponse:
    """The one failure body: a single sentence, under both keys."""
    return JSONResponse(
        status_code=status_code,
        content={"error": message, "detail": message},
        headers=headers,
    )


class AppError(Exception):
    """A failure a handler chose to report, with the status it should carry.

    Raised by the service layer, which has no FastAPI import of its own — the
    services describe *what* went wrong and this decides how it is spelled on
    the wire.
    """

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFound(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(message, status.HTTP_404_NOT_FOUND)


class Forbidden(AppError):
    def __init__(self, message: str = "You do not have access to this"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)


class Conflict(AppError):
    def __init__(self, message: str = "That already exists"):
        super().__init__(message, status.HTTP_409_CONFLICT)


class Unauthorized(AppError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class ServiceUnavailable(AppError):
    def __init__(self, message: str):
        super().__init__(message, status.HTTP_503_SERVICE_UNAVAILABLE)


def _first_validation_message(exc: RequestValidationError) -> str:
    """The first field error, as a sentence naming the field.

    A pydantic error list is unreadable in a toast, and the old zod validator
    answered 400 with one sentence — so this keeps both the status and the
    brevity that the forms were written against.
    """
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", []) if part not in ("body", "query", "path")]
        field = ".".join(location)
        message = error.get("msg", "is invalid")
        return f"{field}: {message}" if field else message
    return "The request body was not valid."


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the handlers that keep every failure in the same shape."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.message, exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else GENERIC_MESSAGE
        return error_response(detail, exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # 400, not FastAPI's 422: the forms on the other side were written
        # against a 400 and branch on it.
        return error_response(_first_validation_message(exc), status.HTTP_400_BAD_REQUEST)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Logged with its route, never returned: the traceback names internals
        # and can echo the caller's own payload back at them.
        logger.exception("%s %s failed", request.method, request.url.path)
        return error_response(GENERIC_MESSAGE, status.HTTP_500_INTERNAL_SERVER_ERROR)
