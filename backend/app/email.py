import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

_SMTP_HOST = os.getenv("SMTP_HOST")
_SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
_SMTP_USER = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_SMTP_FROM = os.getenv("SMTP_FROM") or _SMTP_USER
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_verification_email(to_email: str, token: str) -> None:
    verify_url = f"{_FRONTEND_URL}/verify-email?token={token}"

    if not _SMTP_HOST:
        logger.info("--- EMAIL VERIFICATION (dev mode — SMTP_HOST not set) ---")
        logger.info("To: %s", to_email)
        logger.info("Verification link: %s", verify_url)
        logger.info("----------------------------------------------------------")
        return

    html = f"""
    <p>Welcome to Toy Library!</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="{verify_url}">Verify my email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not register for Toy Library, you can safely ignore this email.</p>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your Toy Library email"
    msg["From"] = _SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        if _SMTP_USER and _SMTP_PASSWORD:
            server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_FROM, [to_email], msg.as_string())
