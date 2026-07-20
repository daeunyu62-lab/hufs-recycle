from pydantic import BaseModel, ConfigDict, Field


class LocationPublic(BaseModel):
    id: int
    name: str
    description: str | None
    allowed_radius_m: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AdminLocationPublic(LocationPublic):
    latitude: float
    longitude: float
    qr_token: str


class AdminLocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    allowed_radius_m: int = Field(gt=0, le=1000)
    is_active: bool = True


class AdminLocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    allowed_radius_m: int | None = Field(default=None, gt=0, le=1000)
    is_active: bool | None = None
