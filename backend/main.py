# file to run backend server

from __future__ import annotations

import os
import sys
from pathlib import Path


def _maybe_reexec_into_venv() -> None:
    backend_dir = Path(__file__).resolve().parent
    candidates = [
        backend_dir / ".venv" / "bin" / "python3",
        backend_dir / "venv" / "bin" / "python3",
    ]

    for candidate in candidates:
        if not candidate.exists():
            continue
        candidate_env = candidate.parent.parent.resolve()
        if Path(sys.prefix).resolve() == candidate_env:
            return
        os.execv(str(candidate), [str(candidate), __file__, *sys.argv[1:]])


_maybe_reexec_into_venv()

import uvicorn

from app.main import asgi_app


if __name__ == "__main__":
    uvicorn.run(asgi_app, host="0.0.0.0", port=8000)