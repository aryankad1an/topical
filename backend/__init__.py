"""Topical's backend.

Layered, and the layers only depend downward:

    api/        HTTP: routing, status codes, request and response bodies
    services/   what the application does, given a session and a user
    db/         tables and the session that reaches them
    auth/       accounts, passwords, and sessions
    realtime/   the collaborative-editing socket
    core/       settings, errors, logging, shared validation

A service never imports FastAPI; a route never writes SQL.
"""

__version__ = "2.0.0"
