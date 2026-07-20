from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, health, locations, submissions, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(locations.router)
api_router.include_router(submissions.router)
api_router.include_router(admin.router)
