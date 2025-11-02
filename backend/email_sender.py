import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import random

SENDER_EMAIL = "raiym0809@gmail.com"  # ← өз email енгіз
APP_PASSWORD = "vpop lcay nvzx pavn"  # ← Gmail app password енгіз

def generate_code():
    return str(random.randint(100000, 999999))

def send_verification_email(receiver_email: str, code: str):
    subject = "Easy жүйесі — тіркелуді растау коды"
    html_body = f"""
    <html>
      <body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
        <div style="max-width:480px;margin:auto;background:#fff;border-radius:8px;padding:20px;
                    box-shadow:0 2px 6px rgba(0,0,0,0.1);">
          <h2 style="color:#4a90e2;text-align:center;">Easy жүйесінен сәлем!</h2>
          <p>Сіздің тіркелуді растау кодыңыз:</p>
          <h1 style="text-align:center;letter-spacing:4px;">{code}</h1>
          <p style="font-size:12px;color:#777;text-align:center;">
            Бұл код 10 минут ішінде жарамды.
          </p>
        </div>
      </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["From"] = SENDER_EMAIL
    message["To"] = receiver_email
    message["Subject"] = subject
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(SENDER_EMAIL, APP_PASSWORD)
        server.send_message(message)
