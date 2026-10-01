import json
from datetime import timedelta
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q
from .models import Notification, StockAlertSubscription


def parse_json(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def json_response(payload, status=200):
    return JsonResponse(payload, status=status, safe=isinstance(payload, dict))


def error_response(message, status=400, **extra):
    payload = {'error': message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def fetch_all(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_one(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        row = cursor.fetchone()
        if row is None:
            return None
        columns = [col[0] for col in cursor.description]
        return dict(zip(columns, row))


def create_notification(user_id, title, body, related_type=None, related_id=None):
    if not user_id or not title or not body:
        return
    Notification.objects.create(
        user_id=user_id,
        title=title,
        body=body,
        related_type=related_type,
        related_id=related_id
    )


def notify_users(user_ids, title, body, related_type=None, related_id=None):
    if not user_ids:
        return
    unique_ids = {int(uid) for uid in user_ids if uid is not None}
    for user_id in unique_ids:
        create_notification(user_id, title, body, related_type, related_id)


def build_recent_day_labels(days):
    labels = []
    today = timezone.now().date()
    for offset in range(days - 1, -1, -1):
        labels.append((today - timedelta(days=offset)).isoformat())
    return labels


def sanitize_user(user):
    if not user:
        return None
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'phone': user.phone,
        'role': user.role,
        'bloodGroup': user.blood_group,
        'city': user.city,
        'isAvailable': bool(user.is_available),
        'createdAt': user.created_at.isoformat() if user.created_at else None
    }


def notify_stock_alert_subscribers(blood_group, bank, units_available, cooldown_minutes=60):
    if not blood_group or not bank or units_available is None:
        return
    parsed_units = int(units_available)
    if parsed_units <= 0:
        return

    city_key = (bank.city or '').strip().lower()
    cutoff = timezone.now() - timedelta(minutes=cooldown_minutes)

    subscriptions = StockAlertSubscription.objects.filter(
        is_active=True,
        blood_group=blood_group
    ).filter(
        Q(city='') | Q(city__iexact=city_key)
    ).filter(
        Q(last_notified_at__isnull=True) | Q(last_notified_at__lte=cutoff)
    )

    if not subscriptions.exists():
        return

    message = f'{blood_group} is now available at {bank.name} ({bank.city}) with {parsed_units} unit(s).'
    for subscription in subscriptions:
        create_notification(
            subscription.user_id,
            'Stock alert available',
            message,
            'blood_bank',
            bank.id
        )

    subscriptions.update(last_notified_at=timezone.now())

