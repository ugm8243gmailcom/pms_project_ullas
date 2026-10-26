"""
Notification and Email Dispatch Service for WAYMARK.
Supports async email dispatch via FastAPI BackgroundTasks, handling both
TLS/STARTTLS (port 587) and SSL (port 465), with robust dev console fallbacks.
"""

import os
import smtplib
from email.message import EmailMessage

SMTP_SERVER = os.getenv("SMTP_SERVER") or os.getenv("SMTP_HOST") or "smtp.gmail.com"
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def send_email_notification(recipient_email: str, subject: str, body: str):
    """
    Sends an email notification using SMTP. Designed to be invoked via FastAPI BackgroundTasks
    so that network round-trips do not block the HTTP request-response cycle.
    """
    # If credentials are not configured, log to server console for seamless local development
    if not SMTP_USER or not SMTP_PASSWORD:
        print("\n" + "=" * 60)
        print("📨 [WAYMARK LOCAL EMAIL DISPATCH - DEV SIMULATION]")
        print(f"To:      {recipient_email}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("=" * 60 + "\n")
        return

    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = f"WAYMARK Workspace <{SMTP_USER}>"
    msg["To"] = recipient_email

    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        print(f"Notification successfully dispatched to {recipient_email}")
    except Exception as exc:
        print(f"Warning: Failed to dispatch SMTP email to {recipient_email}: {str(exc)}")
        # Print fallback so developers can still get the OTP in local dev logs
        print(f"[FALLBACK LOG] Email body intended for {recipient_email}:\n{body}\n")