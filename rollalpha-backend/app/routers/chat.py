import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request

from .. import chat, config
from ..schemas import ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])

# Very small in-memory rate limiter - protects your AI provider bill. Use Redis /
# a gateway limiter when running more than one server process.
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limit(ip: str) -> None:
    now, window = time.time(), 60
    q = _hits[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= config.CHAT_RATE_LIMIT_PER_MIN:
        raise HTTPException(429, "Too many messages. Please wait a minute and try again.")
    q.append(now)


@router.get("/suggestions")
def suggestions():
    return {"questions": chat.SUGGESTED_QUESTIONS}


@router.post("")
def send(req: ChatRequest, request: Request):
    _rate_limit(request.client.host if request.client else "unknown")
    try:
        reply, provider = chat.get_reply([m.model_dump() for m in req.messages])
    except ValueError as e:
        raise HTTPException(422, str(e))
    except chat.ChatUnavailable as e:
        raise HTTPException(502, f"The assistant is temporarily unavailable. {e}")
    return {"reply": reply, "provider": provider}
