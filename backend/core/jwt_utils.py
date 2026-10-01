import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings


def issue_token(user):
    payload = {
        'id': user.id,
        'role': user.role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def decode_token(token):
    return jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])

