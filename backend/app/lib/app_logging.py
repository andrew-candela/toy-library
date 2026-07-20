from enum import Enum
import sys
import structlog


def configure_structlog():
    shared_processors = [
        # Processors that have nothing to do with output,
        # e.g., add timestamps or log level names.
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]
    if sys.stderr.isatty():
        # Pretty printing when we run in a terminal session.
        # Automatically prints pretty tracebacks when "rich" is installed
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]
    else:
        # Print JSON when we run, e.g., in a Docker container.
        # Also print structured tracebacks.
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    structlog.configure(processors)


class LoggerEventType(str, Enum):
    ACTIVITY = "activity"
    REQUEST = "request"


_activity_logger = structlog.getLogger()


def log_activity(type: str, user_id: int, **kwargs):
    """
    Convenience method to log an activity payload
    """
    _activity_logger.info(
        LoggerEventType.ACTIVITY, type=type, user_id=user_id, **kwargs
    )
