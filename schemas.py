from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CustomerCreate(BaseModel):
    name: str
    email: str
    total_spend: float = 0.0
    total_orders: int = 0

class CustomerOut(CustomerCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PricingRequest(BaseModel):
    customer_id: int
    current_order_amount: float
class EmailRequest(BaseModel):
    customer_id: int
    discount_percentage: float
class RecommendationRequest(BaseModel):
    customer_id: int
    recent_purchases: list[str]

class RetentionRequest(BaseModel):
    customer_id: int
    days_since_last_purchase: int
# --- User Authentication Schemas ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True

class PricingRequestAlt(BaseModel):
    customer_identifier: str 
    current_order_amount: float

class EmailRequestAlt(BaseModel):
    customer_identifier: str
    discount_percentage: float

class RecommendationRequestAlt(BaseModel):
    customer_identifier: str
    recent_purchases: list[str]

class RetentionRequestAlt(BaseModel):
    customer_identifier: str
    days_since_last_purchase: int