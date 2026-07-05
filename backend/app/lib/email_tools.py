import os
from html import escape

import resend
import structlog

logger = structlog.get_logger(__name__)

_SEND_EMAIL = os.getenv("LIVE_EMAIL", "false").lower() == "true"
_EMAIL_FROM = os.getenv("EMAIL_FROM", "")
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:81")


async def _send_email(to_email: str, subject: str, html: str) -> None:
    """Send an email via the Resend API.

    Args:
        to_email: The recipient's email address.
        subject: The email subject line.
        html: The HTML body content of the email.
    """
    if not _SEND_EMAIL:
        logger.info("--- EMAIL VERIFICATION (dev mode — AWS_REGION not set) ---")
        logger.info("To: %s", to_email)
        logger.info("subject: %s", subject)
        logger.info("html: %s", html)
        logger.info("---------------------------------------------------------")
        return

    result = await resend.Emails.send_async(
        {
            "from": _EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
    logger.info(f"email sent successfully: {result}")


async def send_verification_email(to_email: str, token: str) -> None:
    """Send an email verification link to a newly registered user.

    In dev mode (when LIVE_EMAIL is not set to true), logs the verification
    link instead of sending an email.

    Args:
        to_email: The recipient's email address.
        token: The email verification token to include in the link.
    """
    verify_url = f"{_FRONTEND_URL}/verify-email?token={token}"

    html = f"""
    <p>Welcome to Toy Library!</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="{verify_url}">Verify my email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not register for Toy Library, you can safely ignore this email.</p>
    """
    await _send_email(to_email, "Verify your Toy Library email", html)


async def send_password_reset_email(to_email: str, token: str, username: str) -> None:
    """Send a password reset link to a user who requested one.

    Args:
        to_email: The recipient's email address.
        token: The password reset token to include in the link.
        username: The user's username, included in the email body for recovery.
    """
    reset_url = f"{_FRONTEND_URL}/reset-password?token={token}"

    html = f"""
    <p>You requested a password reset for your Toy Library account.</p>
    <p>Your username is: <strong>{username}</strong></p>
    <p>Click the link below to set a new password:</p>
    <p><a href="{reset_url}">Reset my password</a></p>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    """
    await _send_email(to_email, "Reset your Toy Library password", html)


async def send_transfer_initiated_email(
    to_email: str, item_title: str, from_username: str
) -> None:
    """Notify a user that another user wants to transfer an item to them.

    Args:
        to_email: The recipient's email address.
        item_title: The title of the item being transferred.
        from_username: The username of the user initiating the transfer.
    """

    html = f"""
    <p><strong>{from_username}</strong> would like to transfer <strong>{item_title}</strong> to you on Toy Library.</p>
    <p>Reach out to <a href="{_FRONTEND_URL}/users/{from_username}">{from_username}</a> from within the toy library
    to coordinate the toy pickup.
    Feel free to establish another communication channel with {from_username} if you trust them.</p>
    <p>Once you actually have the toy, don't forget to log in to 
    <a href="{_FRONTEND_URL}">your account</a> to accept or ignore this transfer.</p>
    """
    await _send_email(to_email, f"You've been offered: {item_title}", html)


async def send_transfer_canceled_email(
    to_email: str, item_title: str, from_username: str
) -> None:
    """Notify a user that a pending item transfer to them has been canceled.

    Args:
        to_email: The recipient's email address.
        item_title: The title of the item whose transfer was canceled.
        from_username: The username of the user who canceled the transfer.
    """

    html = f"""
    <p><strong>{from_username}</strong> has canceled the transfer of <strong>{item_title}</strong> to you on Toy Library.</p>
    """
    await _send_email(to_email, f"Transfer canceled: {item_title}", html)


async def send_transfer_accepted_email(
    to_email: str, item_title: str, to_username: str
) -> None:
    """Notify the original owner that their item transfer has been accepted.

    Args:
        to_email: The recipient's email address (the original owner).
        item_title: The title of the item that was transferred.
        to_username: The username of the user who accepted the transfer.
    """

    html = f"""
    <p><strong>{to_username}</strong> has accepted the transfer of <strong>{item_title}</strong> on Toy Library.</p>
    <p>The item now belongs to them.</p>
    """
    await _send_email(to_email, f"Transfer accepted: {item_title}", html)


async def send_user_contact_email(
    to_email: str,
    to_username: str,
    from_username: str,
    message: str,
) -> None:
    """Send a user-authored contact email to another user.

    The sender username is included for context, but contact info is only
    shared if the sender explicitly writes it in the message.
    """

    safe_to_username = escape(to_username)
    safe_from_username = escape(from_username)
    safe_message = escape(message).replace("\n", "<br />")

    html = f"""
    <p>Hello {safe_to_username},</p>
    <p><a href="{_FRONTEND_URL}/users/{from_username}">{from_username}</a> sent you a message through Toy Library:</p>
    <blockquote style=\"margin: 12px 0; padding: 10px 14px; border-left: 3px solid #ccc;\">{safe_message}</blockquote>
    <p>Want to continue the conversation? Feel free to share your contact info and connect outside Toy Library.</p>
    <p><a href=\"{_FRONTEND_URL}\">Open Toy Library</a></p>
    """

    await _send_email(
        to_email,
        f"New Toy Library message from {safe_from_username}",
        html,
    )
