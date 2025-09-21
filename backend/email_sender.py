import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import random

SENDER_EMAIL = "your_email@gmail.com"
APP_PASSWORD = "your_16_digit_app_password"

def generate_code():
    return str(random.randint(100000, 999999))

def send_verification_email(receiver_email: str, code: str):
    subject = "Тіркелуді растау коды"
    body = f"Сіздің растау кодыңыз: {code}"

    message = MIMEMultipart()
    message["From"] = SENDER_EMAIL
    message["To"] = receiver_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(SENDER_EMAIL, APP_PASSWORD)
        server.send_message(message)

    print(f"[OK] Код {receiver_email} поштасына жіберілді: {code}")
