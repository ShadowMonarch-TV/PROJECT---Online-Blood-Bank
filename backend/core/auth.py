from functools import wraps
from django.http import JsonResponse
from jwt import InvalidTokenError
from .jwt_utils import decode_token
from .models import User


def auth_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.split('Bearer ')[-1] if auth_header.startswith('Bearer ') else None
        if not token:
            return JsonResponse({'error': 'Authentication required.'}, status=401)

        try:
            payload = decode_token(token)
            user = User.objects.filter(id=payload.get('id')).first()
            if not user:
                return JsonResponse({'error': 'Invalid token user.'}, status=401)
            request.user = user
        except InvalidTokenError:
            return JsonResponse({'error': 'Invalid or expired token.'}, status=401)

        return view_func(request, *args, **kwargs)

    return wrapper


def require_roles(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = getattr(request, 'user', None)
            if not user or user.role not in roles:
                return JsonResponse({'error': 'Access denied.'}, status=403)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

