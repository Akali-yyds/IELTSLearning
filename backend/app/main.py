import logging

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import auth, models, schemas
from .database import Base, engine, get_db
from .routers import articles, dictionary, reviews, dashboard, settings, vocabulary
from .routers.translation import router_translation

app = FastAPI(title="IELTSLearning API")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ieltslearning")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(router_translation)
app.include_router(dictionary.router)
app.include_router(vocabulary.router)
app.include_router(reviews.router)
app.include_router(dashboard.router)
app.include_router(settings.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/me", response_model=schemas.UserRead)
def read_current_user(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return current_user

