## Idea / Why

This module adds a minimal authorization layer for backend routes.

It exists to answer one simple question consistently:

- does the current caller have the required role or permission for this endpoint?

The module intentionally stays small. It does not try to become a general policy engine. It provides a stable baseline for backend access checks and leaves more advanced patterns to separate modules if they are ever needed.
