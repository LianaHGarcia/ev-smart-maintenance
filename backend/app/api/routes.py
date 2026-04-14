from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from ..services.chargerService import charger_service
from ..models.schemaValidation import ApiResponse

# REST API routes for the backend

router = APIRouter(prefix="/api/v1")

@router.get("/chargers", response_model=ApiResponse)
async def list_chargers(status: str | None = None) -> ApiResponse:
    chargers = charger_service.list_chargers(status)
    return ApiResponse(success=True, message="Charger list retrieved", data={"chargers": chargers})

@router.get("/chargers/{charger_id}", response_model=ApiResponse)
async def get_charger(charger_id: str) -> ApiResponse:
    charger = charger_service.get_charger(charger_id)
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    return ApiResponse(success=True, message="Charger details retrieved", data={"charger": charger})