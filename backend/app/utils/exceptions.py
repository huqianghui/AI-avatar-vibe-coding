from typing import Any, NoReturn

from fastapi import HTTPException


class AppException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(status_code=status_code, detail={"code": code, "message": message})


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", details: Any = None):
        super().__init__(404, "NOT_FOUND", message, details)


class ValidationException(AppException):
    def __init__(self, message: str = "Validation error", details: Any = None):
        super().__init__(422, "VALIDATION_ERROR", message, details)


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict", details: Any = None):
        super().__init__(409, "CONFLICT", message, details)


class ScoringUnavailableException(AppException):
    def __init__(self, message: str = "Scoring service unavailable", details: Any = None):
        super().__init__(503, "SCORING_UNAVAILABLE", message, details)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized", details: Any = None):
        super().__init__(401, "UNAUTHORIZED", message, details)


def not_found(message: str = "Resource not found") -> NoReturn:
    raise NotFoundException(message)


def bad_request(message: str = "Invalid request") -> NoReturn:
    raise ValidationException(message)


def unauthorized(message: str = "Unauthorized") -> NoReturn:
    raise UnauthorizedException(message)
