"""Vercel Python entrypoint.

The runtime imports an ASGI callable named `app` from this module. Everything lives in
app.main; this file only makes it discoverable and ensures the package resolves when the
function's working directory is not the backend root.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402,F401
