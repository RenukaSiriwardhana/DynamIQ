import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from google import genai
import models
import schemas
from database import engine, SessionLocal
import re
import json
import bcrypt
import os
from dotenv import load_dotenv
from typing import List


load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="DynamIQ - AI-Powered CRM & Dynamic Pricing Assistant")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000","https://dynam-iq-rny3.vercel.app"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/customers/bulk/")
def create_bulk_customers(customers: List[schemas.CustomerCreate], db: Session = Depends(get_db)):
    added_count = 0
    for cust in customers:
        existing = db.query(models.Customer).filter(models.Customer.email == cust.email).first()
        if not existing:
            new_customer = models.Customer(
                name=cust.name,
                email=cust.email,
                total_spend=cust.total_spend,
                total_orders=cust.total_orders
            )
            db.add(new_customer)
            added_count += 1
    db.commit()
    return {"message": f"Successfully added {added_count} new customers!"}
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Password Hashing Setup
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def get_customer_by_id_or_name(identifier: str, db: Session):
    if identifier.isdigit():
        return db.query(models.Customer).filter(models.Customer.id == int(identifier)).first()
    else:
        return db.query(models.Customer).filter(models.Customer.name.ilike(f"%{identifier}%")).first()

def send_real_email(to_email: str, subject: str, body: str):
    sender_email = "YOUR_GMAIL@gmail.com"  
    sender_password = "YOUR_APP_PASSWORD"  

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = to_email
    message["Subject"] = subject

    message.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, message.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Email sending failed: {str(e)}")
        return False

# ---------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------
@app.post("/register/", response_model=schemas.UserOut)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = models.User(name=user.name, email=user.email, hashed_password=hashed_password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login/")
def login_user(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "message": "Login successful", 
        "user_id": db_user.id, 
        "user_name": db_user.name
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to DynamIQ API! System is running successfully."}

@app.post("/customers/", response_model=schemas.CustomerOut)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.email == customer.email).first()
    if db_customer:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_customer = models.Customer(
        name=customer.name, 
        email=customer.email, 
        total_spend=customer.total_spend, 
        total_orders=customer.total_orders
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@app.post("/dynamic-pricing/")
def get_dynamic_pricing(request: schemas.PricingRequestAlt, db: Session = Depends(get_db)):
    customer = get_customer_by_id_or_name(request.customer_identifier, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found by ID or Name")

    prompt = f"""
    You are a pricing assistant for an e-commerce platform.
    Customer Name: {customer.name}
    Total Orders: {customer.total_orders}
    Total Spend: Rs.{customer.total_spend}
    Current Order Amount: Rs.{request.current_order_amount}
    
    Based on the customer's loyalty, suggest a logical discount percentage between 0 and 20 for this current order. 
    Only reply with the number (e.g., 10). Do not include any other text or symbols.
    """

    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro',
            contents=prompt,
        )
        discount_str = response.text.strip()
        numbers = re.findall(r"[-+]?\d*\.\d+|\d+", discount_str)
        discount = float(numbers[0]) if numbers else 5.0
    except Exception as e:
        print("AI Quota exceeded, using smart fallback pricing.")
        discount = 15.0 if customer.total_orders > 10 else 5.0

    return {
        "customer_name": customer.name,
        "loyalty_status": "Platinum" if customer.total_orders >= 20 else ("Gold" if customer.total_orders >= 10 else "Standard"),
        "suggested_discount_percentage": f"{discount}%",
        "final_price": request.current_order_amount - (request.current_order_amount * discount / 100)
    }

@app.post("/generate-promo-email/")
def generate_promo_email(request: schemas.EmailRequestAlt, db: Session = Depends(get_db)):
    customer = get_customer_by_id_or_name(request.customer_identifier, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found by ID or Name")

    prompt = f"""
    Write a short, engaging promotional email to {customer.name}.
    They have been a loyal customer with {customer.total_orders} past orders.
    Offer them a special discount of {request.discount_percentage}% on their next purchase.
    Format the email with 'SUBJECT: ' on the first line, and 'BODY: ' on the next lines.
    Make it sound professional, targeting an auto spare parts buyer.
    """

    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro',
            contents=prompt,
        )
        email_text = response.text.strip()
        status = "AI generated email successfully."
        
    except Exception as e:
        print(f"API Limit reached, using smart fallback email. Error: {e}")
        email_text = f"""SUBJECT: Special {request.discount_percentage}% Discount Just For You, {customer.name}!

BODY:
Dear {customer.name},

As one of our most valued customers, we want to thank you for your continued loyalty to DynamIQ Auto-Parts! 

To show our appreciation for your {customer.total_orders} previous orders, we are thrilled to offer you an exclusive {request.discount_percentage}% discount on your next purchase of auto parts and accessories with us.

Simply show this email or reply to us to claim your discount. We look forward to serving you again soon!

Best Regards,
The DynamIQ Team"""
        status = "System Generated Smart Email (AI Offline)"

    return {
        "customer_name": customer.name,
        "generated_email": email_text,
        "auto_status": status
    }
# ==========================================
# 1. PRODUCT RECOMMENDER ENDPOINT WITH FALLBACK
# ==========================================
@app.post("/recommend-products/")
def recommend_products(request: schemas.RecommendationRequestAlt, db: Session = Depends(get_db)):
    customer = get_customer_by_id_or_name(request.customer_identifier, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found by ID or Name")

    prompt = f"""
    The customer {customer.name} recently purchased: {', '.join(request.recent_purchases)}.
    Based on these auto spare parts, suggest exactly 3 logical complementary parts they might need next.
    Format the output as a simple comma-separated list of 3 items. No bullet points or extra text.
    """

    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro', 
            contents=prompt,
        )
        recommendations = [item.strip() for item in response.text.split(',')]
        # Keep only top 3
        recommendations = recommendations[:3]
    except Exception as e:
        print(f"API Limit reached for Recommender, using smart fallback. Error: {e}")
        recommendations = ["Engine Oil (Premium)", "Wiper Blades Set", "Cabin Air Filter"]

    return {
        "customer_name": customer.name,
        "recommended_products": recommendations
    }


# ==========================================
# 2. RETENTION AI ENDPOINT WITH FALLBACK
# ==========================================
@app.post("/retention-offer/")
def get_retention_offer(request: schemas.RetentionRequestAlt, db: Session = Depends(get_db)):
    customer = get_customer_by_id_or_name(request.customer_identifier, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found by ID or Name")

    prompt = f"""
    Customer Name: {customer.name}
    Days since last purchase: {request.days_since_last_purchase}
    Total Spend: Rs.{customer.total_spend}
    
    Act as an AI retention expert for an auto parts shop. 
    1. Determine churn risk (Low, Medium, High).
    2. Suggest a short retention offer (e.g. Free vehicle checkup, 15% discount).
    3. Write a 1-sentence personalized message.
    
    Output strictly in this format:
    Risk: [Risk Level]
    Offer: [Suggested Offer]
    Message: [1-sentence message]
    """

    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro', 
            contents=prompt,
        )
        text = response.text
        
        # Parse the output
        risk_match = re.search(r"Risk:\s*(.*)", text)
        offer_match = re.search(r"Offer:\s*(.*)", text)
        msg_match = re.search(r"Message:\s*(.*)", text)
        
        risk = risk_match.group(1).strip() if risk_match else "Medium"
        offer = offer_match.group(1).strip() if offer_match else "10% Discount on Next Service"
        msg = msg_match.group(1).strip() if msg_match else f"We miss you at DynamIQ, {customer.name}!"
        
    except Exception as e:
        print(f"API Limit reached for Retention, using smart fallback. Error: {e}")
        if request.days_since_last_purchase > 90:
            risk = "High"
            offer = "15% Win-back Discount"
            msg = f"It's been a while, {customer.name}! Here is a special 15% off to welcome you back."
        elif request.days_since_last_purchase > 30:
            risk = "Medium"
            offer = "Free Engine Oil Check"
            msg = f"Time for a quick checkup, {customer.name}? Drop by for a free oil check!"
        else:
            risk = "Low"
            offer = "Loyalty Points X2"
            msg = f"Thanks for being a regular, {customer.name}. Earn double points on your next visit!"

    return {
        "customer_name": customer.name,
        "retention_strategy": {
            "churn_risk": risk,
            "suggested_offer": offer,
            "message_to_customer": msg
        }
    }