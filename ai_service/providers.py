"""Provider plumbing: credentials, completion calls, and error translation.

Split out of main.py so the route layer only deals with prompts and payloads.
Everything here is provider-agnostic — litellm routes `provider/model` to
whichever vendor the user configured in the browser.
"""

import asyncio
import json
import logging
import random
from dataclasses import dataclass
from functools import wraps
from typing import List, Optional

import litellm
from fastapi import HTTPException, Request
from litellm.types.utils import Choices
from typing import cast

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "gemini"
DEFAULT_MODEL = "gemini-3.7-flash"


@dataclass
class AiCredentials:
    provider: str
    model: str
    api_key: str


def get_ai_credentials(request: Request) -> AiCredentials:
    """Build the provider/model/key trio from request headers.

    The key belongs to the user and lives in their browser; it reaches us only
    as a header on the request that needs it, and is never stored.
    """
    api_key = request.headers.get("x-ai-api-key", "").strip()
    provider = request.headers.get("x-ai-provider", "").strip()
    model = request.headers.get("x-ai-model", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Add one under Profile → AI Providers.",
        )

    return AiCredentials(
        provider=provider or DEFAULT_PROVIDER,
        model=model or DEFAULT_MODEL,
        api_key=api_key,
    )


# Failures worth trying again: capacity, rate limits, timeouts, and transport.
# Gemini in particular returns 503 "this model is currently experiencing high
# demand" often enough that a single attempt makes the app look broken when the
# retry that would have succeeded is one second away.
_RETRYABLE = (
    litellm.ServiceUnavailableError,
    litellm.RateLimitError,
    litellm.InternalServerError,
    litellm.APIConnectionError,
    litellm.Timeout,
)

MAX_ATTEMPTS = 3
_BASE_DELAY_SECONDS = 1.0


async def generate_content(prompt: str, ai_client: AiCredentials) -> str:
    """Generate content via litellm, retrying the failures that are worth retrying.

    Async all the way down: a blocking call here would stall every other
    request for the length of a model round-trip, and the backoff would stall
    it further still.

    No temperature is passed. Gemini 3 models warn that anything below the
    default degrades reasoning and can fail outright, and the other providers'
    defaults are already appropriate for this kind of writing.
    """
    delay = _BASE_DELAY_SECONDS

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # acompletion() is typed to also allow a streaming response; we never
            # pass stream=True, so this is always a plain ModelResponse at runtime.
            response = cast(
                litellm.ModelResponse,
                await litellm.acompletion(
                    model=f"{ai_client.provider}/{ai_client.model}",
                    messages=[{"role": "user", "content": prompt}],
                    api_key=ai_client.api_key,
                ),
            )
            choice = cast(Choices, response.choices[0])
            return choice.message.content or ""

        except _RETRYABLE as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            # Jitter so a burst of parallel requests doesn't retry in lockstep.
            wait = delay + random.uniform(0, 0.4)
            logger.info(
                "%s/%s attempt %d failed (%s); retrying in %.1fs",
                ai_client.provider, ai_client.model, attempt, type(exc).__name__, wait,
            )
            await asyncio.sleep(wait)
            delay *= 2.5


# Provider failures map to the status the client should actually act on, with a
# message safe to show a user. The raw provider payload is logged, never
# returned — it carries request IDs and echoes the caller's own prompt.
_PROVIDER_ERRORS: List[tuple] = [
    (litellm.AuthenticationError, 401,
     "That API key was rejected by {provider}. Check it under Profile → AI Providers."),
    (litellm.PermissionDeniedError, 403,
     "Your {provider} key doesn't have access to '{model}'."),
    (litellm.NotFoundError, 404,
     "{provider} has no model called '{model}'. Pick a different model."),
    (litellm.ContextWindowExceededError, 413,
     "That document is too long for '{model}'. Try a shorter section."),
    (litellm.ContentPolicyViolationError, 422,
     "{provider} declined to generate this content."),
    (litellm.RateLimitError, 429,
     "{provider} is rate-limiting your key. Wait a minute and try again."),
    (litellm.Timeout, 504,
     "{provider} took too long to respond. Try again, or use a faster model."),
    (litellm.ServiceUnavailableError, 502,
     "{provider} says '{model}' is overloaded right now — tried " + str(MAX_ATTEMPTS)
     + " times. Wait a moment, or pick another model under Profile → AI Providers."),
    (litellm.APIConnectionError, 502, "Could not reach {provider}."),
    (litellm.InternalServerError, 502, "{provider} returned an internal error."),
    # Least specific last: several of the above subclass BadRequestError.
    (litellm.BadRequestError, 400,
     "{provider} rejected the request for '{model}'."),
]


def _describe(exc: Exception, creds: Optional[AiCredentials]) -> Optional[tuple]:
    """Map a provider exception to (status, user-facing message), or None."""
    provider = (creds.provider if creds else "the AI provider").capitalize()
    model = creds.model if creds else "the selected model"
    for exc_type, status, template in _PROVIDER_ERRORS:
        if isinstance(exc, exc_type):
            return status, template.format(provider=provider, model=model)
    return None


def endpoint(func):
    """Translate provider and parsing failures into actionable HTTP responses.

    Without this every failure reached the browser as a 500 carrying a raw
    provider exception, so a mistyped API key was indistinguishable from an
    outage and the UI had nothing to branch on.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # The credentials are a keyword dependency; used only to name the
        # provider and model in the message.
        creds = kwargs.get("ai_client")
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except json.JSONDecodeError as e:
            logger.error("%s: model returned unparseable JSON: %s", func.__name__, e)
            raise HTTPException(
                status_code=502,
                detail="The model returned a malformed response. Try again.",
            )
        except Exception as e:
            described = _describe(e, creds)
            if described:
                status, message = described
                logger.warning("%s: %s (%s)", func.__name__, type(e).__name__, e)
                raise HTTPException(status_code=status, detail=message)
            logger.exception("%s failed unexpectedly", func.__name__)
            raise HTTPException(
                status_code=500,
                detail="Content generation failed unexpectedly. Please try again.",
            )
    return wrapper
