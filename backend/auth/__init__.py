"""Accounts, passwords, and sessions.

Authentication is in-house: there is no identity provider, no redirect flow,
and no token minted elsewhere to trust. An account is a ``users`` row with an
Argon2id password hash; a session is an ``auth_sessions`` row addressed by an
opaque cookie token, so signing out revokes it immediately.
"""
