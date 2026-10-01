from datetime import timedelta
from pathlib import Path
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.http import FileResponse
from django.conf import settings

from .auth import auth_required, require_roles
from .jwt_utils import issue_token
from .models import (
    BLOOD_GROUPS,
    User,
    BloodBank,
    BloodStock,
    Booking,
    EmergencyRequest,
    EmergencyResponse,
    Notification,
    FavoriteBloodBank,
    StockAlertSubscription
)
from .utils import (
    parse_json,
    json_response,
    error_response,
    sanitize_user,
    create_notification,
    notify_users,
    build_recent_day_labels,
    fetch_all,
    fetch_one,
    notify_stock_alert_subscribers
)

USER_ROLES = ['user', 'donor', 'blood_bank', 'admin']
STOCK_ALERT_COOLDOWN_MINUTES = 60

COMPATIBILITY = {
    'O-': { 'canReceiveFrom': ['O-'], 'canDonateTo': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] },
    'O+': { 'canReceiveFrom': ['O-', 'O+'], 'canDonateTo': ['O+', 'A+', 'B+', 'AB+'] },
    'A-': { 'canReceiveFrom': ['O-', 'A-'], 'canDonateTo': ['A-', 'A+', 'AB-', 'AB+'] },
    'A+': { 'canReceiveFrom': ['O-', 'O+', 'A-', 'A+'], 'canDonateTo': ['A+', 'AB+'] },
    'B-': { 'canReceiveFrom': ['O-', 'B-'], 'canDonateTo': ['B-', 'B+', 'AB-', 'AB+'] },
    'B+': { 'canReceiveFrom': ['O-', 'O+', 'B-', 'B+'], 'canDonateTo': ['B+', 'AB+'] },
    'AB-': { 'canReceiveFrom': ['O-', 'A-', 'B-', 'AB-'], 'canDonateTo': ['AB-', 'AB+'] },
    'AB+': { 'canReceiveFrom': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], 'canDonateTo': ['AB+'] }
}


@csrf_exempt
def health(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)
    return json_response({'status': 'ok', 'timestamp': timezone.now().isoformat()})


@csrf_exempt
def blood_groups(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)
    return json_response({'bloodGroups': BLOOD_GROUPS})


@csrf_exempt
def compatibility(request, blood_group):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)
    if blood_group not in BLOOD_GROUPS:
        return error_response('Invalid blood group.', status=400)
    return json_response({'bloodGroup': blood_group, 'compatibility': COMPATIBILITY[blood_group]})


@csrf_exempt
def register(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = data.get('phone')
    password = data.get('password')
    role = data.get('role') or 'user'
    blood_group = data.get('bloodGroup') or None
    city = data.get('city') or None
    bank_name = data.get('bankName')
    bank_address = data.get('bankAddress')
    bank_contact = data.get('bankContact')

    if not name or not email or not password:
        return error_response('Name, email, and password are required.', status=400)

    if role not in USER_ROLES or role == 'admin':
        return error_response('Invalid role for registration.', status=400)

    if blood_group and blood_group not in BLOOD_GROUPS:
        return error_response('Invalid blood group.', status=400)

    if role == 'donor' and not blood_group:
        return error_response('Donor registration requires blood group.', status=400)

    if role == 'blood_bank' and (not bank_name or not bank_address or not bank_contact or not city):
        return error_response('Bank name, address, contact, and city are required for blood bank accounts.', status=400)

    if User.objects.filter(email__iexact=email).exists():
        return error_response('Email already exists.', status=409)

    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            password=password,
            name=name,
            phone=phone,
            role=role,
            blood_group=blood_group,
            city=city,
            is_available=True if role == 'donor' else False
        )

        bank_payload = None
        if role == 'blood_bank':
            bank = BloodBank.objects.create(
                name=str(bank_name).strip(),
                address=str(bank_address).strip(),
                city=str(city).strip(),
                contact=str(bank_contact).strip(),
                owner_user=user
            )

            for group in BLOOD_GROUPS:
                BloodStock.objects.create(bank=bank, blood_group=group, units_available=0)

            bank_payload = {
                'id': bank.id,
                'name': bank.name,
                'address': bank.address,
                'city': bank.city,
                'contact': bank.contact
            }

    token = issue_token(user)
    return json_response(
        {
            'message': 'Registration successful.',
            'token': token,
            'user': sanitize_user(user),
            'bank': bank_payload
        },
        status=201
    )


@csrf_exempt
def login(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        return error_response('Email and password are required.', status=400)

    user = User.objects.filter(email__iexact=email).first()
    if not user or not user.check_password(password):
        return error_response('Invalid email or password.', status=401)

    bank_payload = None
    if user.role == 'blood_bank':
        bank = BloodBank.objects.filter(owner_user=user).first()
        if bank:
            bank_payload = {
                'id': bank.id,
                'name': bank.name,
                'address': bank.address,
                'city': bank.city,
                'contact': bank.contact
            }

    token = issue_token(user)
    return json_response(
        {
            'message': 'Login successful.',
            'token': token,
            'user': sanitize_user(user),
            'bank': bank_payload
        }
    )


@csrf_exempt
@auth_required
def me(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    bank_payload = None
    if request.user.role == 'blood_bank':
        bank = BloodBank.objects.filter(owner_user=request.user).first()
        if bank:
            bank_payload = {
                'id': bank.id,
                'name': bank.name,
                'address': bank.address,
                'city': bank.city,
                'contact': bank.contact
            }

    return json_response({'user': sanitize_user(request.user), 'bank': bank_payload})


@csrf_exempt
@auth_required
def update_profile(request):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    name = data.get('name')
    phone = data.get('phone')
    city = data.get('city')
    blood_group = data.get('bloodGroup')

    if name is not None:
        if not str(name).strip() or len(str(name).strip()) < 2:
            return error_response('Name must be at least 2 characters.', status=400)
        request.user.name = str(name).strip()

    if blood_group is not None:
        if blood_group and blood_group not in BLOOD_GROUPS:
            return error_response('Invalid blood group.', status=400)
        request.user.blood_group = blood_group or None

    if phone is not None:
        request.user.phone = phone or None
    if city is not None:
        request.user.city = city or None

    request.user.save(update_fields=['name', 'phone', 'city', 'blood_group'])
    return json_response({'message': 'Profile updated.', 'user': sanitize_user(request.user)})


@csrf_exempt
@auth_required
def change_password(request):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return error_response('Current and new password are required.', status=400)

    if not request.user.check_password(current_password):
        return error_response('Current password is incorrect.', status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    return json_response({'message': 'Password updated.'})


@csrf_exempt
def blood_search(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    group = request.GET.get('group')
    city = request.GET.get('city')

    stocks = BloodStock.objects.select_related('bank')
    if group:
        if group not in BLOOD_GROUPS:
            return error_response('Invalid blood group.', status=400)
        stocks = stocks.filter(blood_group=group)
    if city:
        stocks = stocks.filter(bank__city__icontains=city.strip())

    stocks = stocks.order_by('-units_available', 'bank__name', 'blood_group')

    results = [
        {
            'bank_id': stock.bank.id,
            'bank_name': stock.bank.name,
            'city': stock.bank.city,
            'blood_group': stock.blood_group,
            'units_available': stock.units_available,
            'contact': stock.bank.contact
        }
        for stock in stocks
    ]

    return json_response({'results': results})

@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def favorites_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT f.bank_id,
               b.name AS bank_name,
               b.city AS bank_city,
               b.contact AS bank_contact,
               COALESCE(SUM(s.units_available), 0) AS total_units
        FROM favorite_blood_banks f
        INNER JOIN blood_banks b ON b.id = f.bank_id
        LEFT JOIN blood_stock s ON s.bank_id = b.id
        WHERE f.user_id = %s
        GROUP BY f.bank_id
        ORDER BY f.created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'favorites': rows})


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def favorites_add(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    bank_id = data.get('bankId')

    try:
        bank_id = int(bank_id)
    except (TypeError, ValueError):
        return error_response('Valid bankId is required.', status=400)

    bank = BloodBank.objects.filter(id=bank_id).first()
    if not bank:
        return error_response('Blood bank not found.', status=404)

    FavoriteBloodBank.objects.get_or_create(user=request.user, bank=bank)

    create_notification(
        request.user.id,
        'Favorite saved',
        f'{bank.name} was added to your favorites.',
        'blood_bank',
        bank_id
    )

    return json_response({'message': 'Blood bank added to favorites.'}, status=201)


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def favorites_remove(request, bank_id):
    if request.method != 'DELETE':
        return error_response('Method not allowed.', status=405)

    FavoriteBloodBank.objects.filter(user=request.user, bank_id=bank_id).delete()
    return json_response({'message': 'Blood bank removed from favorites.'})


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def alerts_subscribe(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    blood_group = data.get('bloodGroup')
    city_value = data.get('city') or ''
    city = str(city_value).strip().lower()

    if not blood_group or blood_group not in BLOOD_GROUPS:
        return error_response('Valid bloodGroup is required.', status=400)

    subscription, _ = StockAlertSubscription.objects.update_or_create(
        user=request.user,
        blood_group=blood_group,
        city=city,
        defaults={'is_active': True}
    )

    return json_response(
        {
            'message': 'Stock alert subscription saved.',
            'subscription': {
                'id': subscription.id,
                'bloodGroup': subscription.blood_group,
                'city': subscription.city or None,
                'isActive': bool(subscription.is_active),
                'createdAt': subscription.created_at.isoformat() if subscription.created_at else None,
                'lastNotifiedAt': subscription.last_notified_at.isoformat() if subscription.last_notified_at else None
            }
        },
        status=201
    )


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def alerts_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT s.id,
               s.blood_group,
               s.city,
               s.is_active,
               s.created_at,
               s.last_notified_at,
               (
                 SELECT COUNT(*)
                 FROM blood_stock bs
                 INNER JOIN blood_banks bb ON bb.id = bs.bank_id
                 WHERE bs.blood_group = s.blood_group
                   AND bs.units_available > 0
                   AND (s.city = '' OR LOWER(bb.city) = s.city)
               ) AS matching_banks
        FROM stock_alert_subscriptions s
        WHERE s.user_id = %s
        ORDER BY s.created_at DESC
        """,
        [request.user.id]
    )

    subscriptions = [
        {
            'id': row['id'],
            'bloodGroup': row['blood_group'],
            'city': row['city'] or None,
            'isActive': bool(row['is_active']),
            'matchingBanks': int(row['matching_banks'] or 0),
            'createdAt': row['created_at'],
            'lastNotifiedAt': row['last_notified_at']
        }
        for row in rows
    ]

    return json_response({'subscriptions': subscriptions})


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def alerts_update_status(request, alert_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    is_active = data.get('isActive')

    if not isinstance(is_active, bool):
        return error_response('isActive must be boolean.', status=400)

    subscription = StockAlertSubscription.objects.filter(id=alert_id, user=request.user).first()
    if not subscription:
        return error_response('Subscription not found.', status=404)

    subscription.is_active = is_active
    subscription.save(update_fields=['is_active'])

    state = 'enabled' if is_active else 'disabled'
    return json_response({'message': f'Subscription {state}.'})


@csrf_exempt
@auth_required
@require_roles('user', 'donor', 'admin')
def alerts_delete(request, alert_id):
    if request.method != 'DELETE':
        return error_response('Method not allowed.', status=405)

    subscription = StockAlertSubscription.objects.filter(id=alert_id, user=request.user).first()
    if not subscription:
        return error_response('Subscription not found.', status=404)

    subscription.delete()
    return json_response({'message': 'Subscription removed.'})


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def bookings_create(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    bank_id = data.get('bankId')
    blood_group = data.get('bloodGroup')
    units_required = data.get('unitsRequired')

    if not bank_id or not blood_group or not units_required:
        return error_response('bankId, bloodGroup, and unitsRequired are required.', status=400)

    if blood_group not in BLOOD_GROUPS:
        return error_response('Invalid blood group.', status=400)

    try:
        units = int(units_required)
    except (TypeError, ValueError):
        return error_response('unitsRequired must be a positive integer.', status=400)

    if units <= 0:
        return error_response('unitsRequired must be a positive integer.', status=400)

    bank = BloodBank.objects.filter(id=bank_id).first()
    if not bank:
        return error_response('Selected blood bank does not exist.', status=404)

    stock_exists = BloodStock.objects.filter(bank=bank, blood_group=blood_group).exists()
    if not stock_exists:
        return error_response('Selected blood bank does not manage this blood group.', status=404)

    booking = Booking.objects.create(
        user=request.user,
        bank=bank,
        blood_group=blood_group,
        units_required=units,
        status='pending'
    )

    booking_payload = {
        'id': booking.id,
        'blood_group': booking.blood_group,
        'units_required': booking.units_required,
        'status': booking.status,
        'reason': booking.reason,
        'created_at': booking.created_at.isoformat(),
        'bank_name': bank.name,
        'bank_city': bank.city
    }

    if bank.owner_user_id:
        create_notification(
            bank.owner_user_id,
            'New booking request',
            f'New {blood_group} booking for {units} unit(s).',
            'booking',
            booking.id
        )

    return json_response({'message': 'Booking request submitted.', 'booking': booking_payload}, status=201)


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def bookings_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT b.id, b.blood_group, b.units_required, b.status, b.reason, b.created_at, b.updated_at,
               bb.name AS bank_name, bb.city AS bank_city, bb.contact AS bank_contact
        FROM bookings b
        INNER JOIN blood_banks bb ON bb.id = b.bank_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'bookings': rows})


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def bookings_cancel(request, booking_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    booking = Booking.objects.filter(id=booking_id, user=request.user).first()
    if not booking:
        return error_response('Booking not found.', status=404)

    if booking.status != 'pending':
        return error_response('Only pending bookings can be canceled.', status=400)

    booking.status = 'rejected'
    booking.reason = 'Cancelled by user.'
    booking.save(update_fields=['status', 'reason', 'updated_at'])

    return json_response({'message': 'Booking canceled.'})


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def emergency_create(request):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    blood_group = data.get('bloodGroup')
    units_needed = data.get('unitsNeeded')
    city = data.get('city')
    message = data.get('message')

    if not blood_group or not units_needed:
        return error_response('bloodGroup and unitsNeeded are required.', status=400)

    if blood_group not in BLOOD_GROUPS:
        return error_response('Invalid blood group.', status=400)

    try:
        units = int(units_needed)
    except (TypeError, ValueError):
        return error_response('unitsNeeded must be a positive integer.', status=400)

    if units <= 0:
        return error_response('unitsNeeded must be a positive integer.', status=400)

    request_city = (city or request.user.city or '').strip()

    emergency = EmergencyRequest.objects.create(
        requester=request.user,
        city=request_city or None,
        blood_group=blood_group,
        units_needed=units,
        message=message or None,
        status='open'
    )

    request_payload = {
        'id': emergency.id,
        'city': emergency.city,
        'blood_group': emergency.blood_group,
        'units_needed': emergency.units_needed,
        'message': emergency.message,
        'status': emergency.status,
        'created_at': emergency.created_at.isoformat(),
        'requester_name': request.user.name,
        'requester_phone': request.user.phone
    }

    donor_query = User.objects.filter(role='donor', is_available=True, blood_group=blood_group)
    if request_city:
        donor_query = donor_query.filter(city__iexact=request_city)

    region = request_city or 'your region'
    notify_users(
        donor_query.values_list('id', flat=True),
        'Emergency blood request',
        f'Emergency need: {blood_group} ({units} unit(s)) in {region}.',
        'emergency_request',
        emergency.id
    )

    return json_response({'message': 'Emergency request created.', 'request': request_payload}, status=201)


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def emergency_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT id, city, blood_group, units_needed, message, status, created_at, updated_at
        FROM emergency_requests
        WHERE requester_id = %s
        ORDER BY created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'requests': rows})


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def emergency_my_responses(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT er.id AS emergency_request_id,
               er.blood_group,
               er.city,
               er.units_needed,
               er.status AS request_status,
               rsp.id AS response_id,
               rsp.note,
               rsp.status AS response_status,
               rsp.created_at,
               d.name AS donor_name,
               d.phone AS donor_phone
        FROM emergency_requests er
        LEFT JOIN emergency_responses rsp ON rsp.emergency_request_id = er.id
        LEFT JOIN users d ON d.id = rsp.donor_id
        WHERE er.requester_id = %s
        ORDER BY rsp.created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'responses': rows})


@csrf_exempt
@auth_required
@require_roles('user', 'admin')
def emergency_close(request, request_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    emergency = EmergencyRequest.objects.filter(id=request_id, requester=request.user).first()
    if not emergency:
        return error_response('Emergency request not found.', status=404)

    emergency.status = 'closed'
    emergency.save(update_fields=['status', 'updated_at'])
    return json_response({'message': 'Emergency request closed.'})


@csrf_exempt
@auth_required
@require_roles('donor')
def donor_availability(request):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    is_available = data.get('isAvailable')
    if not isinstance(is_available, bool):
        return error_response('isAvailable must be boolean.', status=400)

    request.user.is_available = is_available
    request.user.save(update_fields=['is_available'])

    return json_response({'message': 'Availability updated.', 'user': sanitize_user(request.user)})


@csrf_exempt
@auth_required
@require_roles('donor')
def donor_requests(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    if not request.user.blood_group:
        return error_response('Donor blood group is not configured in profile.', status=400)

    rows = fetch_all(
        """
        SELECT er.id,
               er.city,
               er.blood_group,
               er.units_needed,
               er.status AS request_status,
               er.created_at,
               u.name AS requester_name,
               u.phone AS requester_phone,
               u.city AS requester_city,
               rsp.status AS donor_response_status,
               rsp.note AS donor_response_note
        FROM emergency_requests er
        INNER JOIN users u ON u.id = er.requester_id
        LEFT JOIN emergency_responses rsp
          ON rsp.emergency_request_id = er.id AND rsp.donor_id = %s
        WHERE er.status = 'open'
          AND er.blood_group = %s
          AND (
            er.city IS NULL
            OR er.city = ''
            OR LOWER(er.city) = LOWER(COALESCE(%s, ''))
          )
        ORDER BY er.created_at DESC
        """,
        [request.user.id, request.user.blood_group, request.user.city]
    )

    return json_response({'requests': rows})


@csrf_exempt
@auth_required
@require_roles('donor')
def donor_respond(request, request_id):
    if request.method != 'POST':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    note = data.get('note')

    emergency = EmergencyRequest.objects.filter(id=request_id).first()
    if not emergency:
        return error_response('Emergency request not found.', status=404)

    response, _ = EmergencyResponse.objects.update_or_create(
        emergency_request=emergency,
        donor=request.user,
        defaults={'note': note or None, 'status': 'accepted'}
    )

    create_notification(
        emergency.requester_id,
        'Donor response received',
        f'{request.user.name} responded to your emergency request.',
        'emergency_request',
        emergency.id
    )

    return json_response({'message': 'Donor response recorded.', 'responseId': response.id})


@csrf_exempt
@auth_required
@require_roles('donor')
def donor_withdraw(request, request_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    response = EmergencyResponse.objects.filter(emergency_request_id=request_id, donor=request.user).first()
    if not response:
        return error_response('Response not found.', status=404)

    response.status = 'withdrawn'
    response.save(update_fields=['status', 'updated_at'])

    return json_response({'message': 'Response withdrawn.'})


@csrf_exempt
@auth_required
@require_roles('donor')
def donor_responses(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT rsp.id, rsp.emergency_request_id, rsp.note, rsp.status, rsp.created_at,
               er.blood_group, er.city, er.units_needed
        FROM emergency_responses rsp
        INNER JOIN emergency_requests er ON er.id = rsp.emergency_request_id
        WHERE rsp.donor_id = %s
        ORDER BY rsp.created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'responses': rows})

@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_stock(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    rows = fetch_all(
        """
        SELECT blood_group, units_available, updated_at
        FROM blood_stock
        WHERE bank_id = %s
        ORDER BY blood_group ASC
        """,
        [bank.id]
    )

    return json_response({'bank': {'id': bank.id, 'name': bank.name}, 'stock': rows})


@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_low_stock(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    threshold = request.GET.get('threshold', 5)
    try:
        threshold = int(threshold)
    except (TypeError, ValueError):
        return error_response('threshold must be a non-negative integer.', status=400)

    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    rows = fetch_all(
        """
        SELECT blood_group, units_available, updated_at
        FROM blood_stock
        WHERE bank_id = %s AND units_available <= %s
        ORDER BY units_available ASC, blood_group ASC
        """,
        [bank.id, threshold]
    )

    return json_response({'threshold': threshold, 'lowStock': rows})


@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_update_stock(request, blood_group):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    if blood_group not in BLOOD_GROUPS:
        return error_response('Invalid blood group.', status=400)

    data = parse_json(request)
    units = data.get('units')
    try:
        units = int(units)
    except (TypeError, ValueError):
        return error_response('Units must be a non-negative integer.', status=400)

    if units < 0:
        return error_response('Units must be a non-negative integer.', status=400)

    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    stock, _ = BloodStock.objects.get_or_create(bank=bank, blood_group=blood_group)
    stock.units_available = units
    stock.save(update_fields=['units_available', 'updated_at'])

    notify_stock_alert_subscribers(blood_group, bank, units, cooldown_minutes=STOCK_ALERT_COOLDOWN_MINUTES)

    return json_response({'message': 'Stock updated.', 'stock': {
        'blood_group': stock.blood_group,
        'units_available': stock.units_available,
        'updated_at': stock.updated_at.isoformat()
    }})


@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_bookings(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    status = request.GET.get('status')
    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    params = [bank.id]
    status_clause = ''
    if status:
        status_clause = 'AND b.status = %s'
        params.append(status)

    rows = fetch_all(
        f"""
        SELECT b.id, b.blood_group, b.units_required, b.status, b.reason, b.created_at, b.updated_at,
               u.name AS user_name, u.email AS user_email, u.phone AS user_phone
        FROM bookings b
        INNER JOIN users u ON u.id = b.user_id
        WHERE b.bank_id = %s {status_clause}
        ORDER BY b.created_at DESC
        """,
        params
    )

    return json_response({'bookings': rows})


@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_bookings_update(request, booking_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    status = data.get('status')
    reason = data.get('reason')

    if status not in ['approved', 'rejected']:
        return error_response('Invalid status.', status=400)

    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    booking = Booking.objects.filter(id=booking_id, bank=bank).first()
    if not booking:
        return error_response('Booking not found.', status=404)

    if status == 'approved':
        stock = BloodStock.objects.filter(bank=bank, blood_group=booking.blood_group).first()
        if not stock:
            return error_response('Stock record not found.', status=404)
        if stock.units_available < booking.units_required:
            return error_response('Insufficient stock to approve booking.', status=400)

        stock.units_available -= booking.units_required
        stock.save(update_fields=['units_available', 'updated_at'])

    booking.status = status
    booking.reason = reason or None
    booking.save(update_fields=['status', 'reason', 'updated_at'])

    create_notification(
        booking.user_id,
        f'Booking {status}',
        f'Your booking for {booking.blood_group} was {status}.',
        'booking',
        booking.id
    )

    return json_response({'message': f'Booking {status}.'})


@csrf_exempt
@auth_required
def notifications_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT id, title, body, related_type, related_id, is_read, created_at
        FROM notifications
        WHERE user_id = %s
        ORDER BY created_at DESC
        """,
        [request.user.id]
    )

    return json_response({'notifications': rows})


@csrf_exempt
@auth_required
def notifications_unread_count(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    row = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM notifications
        WHERE user_id = %s AND is_read = 0
        """,
        [request.user.id]
    )

    return json_response({'unread': int(row['total'] if row else 0)})


@csrf_exempt
@auth_required
def notifications_mark_read(request, notification_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    notification = Notification.objects.filter(id=notification_id, user=request.user).first()
    if not notification:
        return error_response('Notification not found.', status=404)

    notification.is_read = True
    notification.save(update_fields=['is_read'])
    return json_response({'message': 'Notification marked as read.'})


@csrf_exempt
@auth_required
def notifications_mark_all(request):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return json_response({'message': 'All notifications marked as read.'})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_low_stock(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    threshold = request.GET.get('threshold', 5)
    try:
        threshold = int(threshold)
    except (TypeError, ValueError):
        return error_response('threshold must be a non-negative integer.', status=400)

    rows = fetch_all(
        """
        SELECT b.id AS bank_id, b.name AS bank_name, b.city AS bank_city, b.contact AS bank_contact,
               s.blood_group, s.units_available, s.updated_at
        FROM blood_stock s
        INNER JOIN blood_banks b ON b.id = s.bank_id
        WHERE s.units_available <= %s
        ORDER BY s.units_available ASC, b.name ASC, s.blood_group ASC
        """,
        [threshold]
    )

    return json_response({'threshold': threshold, 'lowStock': rows})


@csrf_exempt
@auth_required
def activity_my(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    days = request.GET.get('days', 14)
    try:
        days = max(min(int(days), 90), 1)
    except (TypeError, ValueError):
        days = 14

    labels = build_recent_day_labels(days)
    since_date = labels[0]

    if request.user.role == 'donor':
        rows = fetch_all(
            """
            SELECT DATE(created_at) AS day, COUNT(*) AS total
            FROM emergency_responses
            WHERE donor_id = %s
              AND status = 'accepted'
              AND DATE(created_at) >= DATE(%s)
            GROUP BY DATE(created_at)
            """,
            [request.user.id, since_date]
        )
        response_map = {row['day']: row['total'] for row in rows}
        timeline = [{'day': day, 'responses': int(response_map.get(day, 0) or 0)} for day in labels]
        return json_response({'kind': 'donor', 'days': days, 'timeline': timeline})

    if request.user.role == 'blood_bank':
        bank = BloodBank.objects.filter(owner_user=request.user).first()
        if not bank:
            return json_response({'kind': 'blood_bank', 'days': days, 'timeline': [{'day': day, 'requests': 0, 'approved': 0} for day in labels]})

        rows = fetch_all(
            """
            SELECT DATE(created_at) AS day,
                   COUNT(*) AS requests,
                   SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
            FROM bookings
            WHERE bank_id = %s
              AND DATE(created_at) >= DATE(%s)
            GROUP BY DATE(created_at)
            """,
            [bank.id, since_date]
        )
        map_rows = {row['day']: row for row in rows}
        timeline = [
            {
                'day': day,
                'requests': int(map_rows.get(day, {}).get('requests', 0) or 0),
                'approved': int(map_rows.get(day, {}).get('approved', 0) or 0)
            }
            for day in labels
        ]
        return json_response({'kind': 'blood_bank', 'days': days, 'timeline': timeline})

    booking_rows = fetch_all(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM bookings
        WHERE user_id = %s AND DATE(created_at) >= DATE(%s)
        GROUP BY DATE(created_at)
        """,
        [request.user.id, since_date]
    )

    emergency_rows = fetch_all(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM emergency_requests
        WHERE requester_id = %s AND DATE(created_at) >= DATE(%s)
        GROUP BY DATE(created_at)
        """,
        [request.user.id, since_date]
    )

    booking_map = {row['day']: row['total'] for row in booking_rows}
    emergency_map = {row['day']: row['total'] for row in emergency_rows}

    timeline = [
        {
            'day': day,
            'bookings': int(booking_map.get(day, 0) or 0),
            'emergencies': int(emergency_map.get(day, 0) or 0)
        }
        for day in labels
    ]

    return json_response({'kind': 'user', 'days': days, 'timeline': timeline})


@csrf_exempt
@auth_required
@require_roles('blood_bank')
def bank_analytics(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    days = request.GET.get('days', 14)
    try:
        days = max(min(int(days), 90), 1)
    except (TypeError, ValueError):
        days = 14

    labels = build_recent_day_labels(days)
    since_date = labels[0]

    bank = BloodBank.objects.filter(owner_user=request.user).first()
    if not bank:
        return error_response('Blood bank profile not found.', status=404)

    rows = fetch_all(
        """
        SELECT DATE(created_at) AS day,
               COUNT(*) AS total,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
               SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM bookings
        WHERE bank_id = %s AND DATE(created_at) >= DATE(%s)
        GROUP BY DATE(created_at)
        """,
        [bank.id, since_date]
    )

    map_rows = {row['day']: row for row in rows}
    timeline = [
        {
            'day': day,
            'total': int(map_rows.get(day, {}).get('total', 0) or 0),
            'approved': int(map_rows.get(day, {}).get('approved', 0) or 0),
            'rejected': int(map_rows.get(day, {}).get('rejected', 0) or 0),
            'pending': int(map_rows.get(day, {}).get('pending', 0) or 0)
        }
        for day in labels
    ]

    stock_distribution = fetch_all(
        """
        SELECT blood_group, units_available
        FROM blood_stock
        WHERE bank_id = %s
        ORDER BY blood_group ASC
        """,
        [bank.id]
    )

    return json_response({'bank': {'id': bank.id, 'name': bank.name}, 'days': days, 'timeline': timeline, 'stockDistribution': stock_distribution})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_analytics_summary(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    days = request.GET.get('days', 14)
    try:
        days = max(min(int(days), 90), 1)
    except (TypeError, ValueError):
        days = 14

    labels = build_recent_day_labels(days)
    since_date = labels[0]

    booking_rows = fetch_all(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM bookings
        WHERE DATE(created_at) >= DATE(%s)
        GROUP BY DATE(created_at)
        """,
        [since_date]
    )

    emergency_rows = fetch_all(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM emergency_requests
        WHERE DATE(created_at) >= DATE(%s)
        GROUP BY DATE(created_at)
        """,
        [since_date]
    )

    booking_map = {row['day']: row['total'] for row in booking_rows}
    emergency_map = {row['day']: row['total'] for row in emergency_rows}

    timeline = [
        {
            'day': day,
            'bookings': int(booking_map.get(day, 0) or 0),
            'emergencies': int(emergency_map.get(day, 0) or 0)
        }
        for day in labels
    ]

    city_demand = fetch_all(
        """
        SELECT COALESCE(NULLIF(TRIM(u.city), ''), 'Unknown') AS city, COUNT(*) AS total
        FROM emergency_requests er
        INNER JOIN users u ON u.id = er.requester_id
        WHERE DATE(er.created_at) >= DATE(%s)
        GROUP BY city
        ORDER BY total DESC
        LIMIT 8
        """,
        [since_date]
    )

    blood_group_demand = fetch_all(
        """
        SELECT blood_group, COUNT(*) AS total
        FROM emergency_requests
        WHERE DATE(created_at) >= DATE(%s)
        GROUP BY blood_group
        ORDER BY total DESC
        """,
        [since_date]
    )

    approved_row = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM bookings
        WHERE status = 'approved' AND DATE(created_at) >= DATE(%s)
        """,
        [since_date]
    )

    approved_bookings = int(approved_row['total'] if approved_row else 0)

    return json_response({
        'days': days,
        'timeline': timeline,
        'approvedBookings': approved_bookings,
        'cityDemand': city_demand,
        'bloodGroupDemand': blood_group_demand
    })


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_stats(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    users_count = User.objects.count()
    donors = User.objects.filter(role='donor').count()
    blood_banks = BloodBank.objects.count()
    pending_bookings = Booking.objects.filter(status='pending').count()
    open_emergency = EmergencyRequest.objects.filter(status='open').count()
    total_stock = BloodStock.objects.aggregate(total=Sum('units_available')).get('total') or 0

    return json_response({
        'stats': {
            'users': users_count,
            'donors': donors,
            'bloodBanks': blood_banks,
            'pendingBookings': pending_bookings,
            'openEmergency': open_emergency,
            'totalStock': int(total_stock)
        }
    })


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_users(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT id, name, email, phone, role, blood_group, city, is_available, created_at
        FROM users
        ORDER BY created_at DESC
        """
    )

    return json_response({'users': rows})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_blood_banks(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT b.id, b.name, b.address, b.city, b.contact, b.created_at,
               u.name AS owner_name, u.email AS owner_email,
               COALESCE(SUM(s.units_available), 0) AS total_units
        FROM blood_banks b
        LEFT JOIN users u ON u.id = b.owner_user_id
        LEFT JOIN blood_stock s ON s.bank_id = b.id
        GROUP BY b.id
        ORDER BY b.created_at DESC
        """
    )

    return json_response({'banks': rows})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_bookings(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT b.id, b.blood_group, b.units_required, b.status, b.reason, b.created_at, b.updated_at,
               u.name AS user_name, u.email AS user_email,
               bb.name AS bank_name, bb.city AS bank_city
        FROM bookings b
        INNER JOIN users u ON u.id = b.user_id
        INNER JOIN blood_banks bb ON bb.id = b.bank_id
        ORDER BY b.created_at DESC
        """
    )

    return json_response({'bookings': rows})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_emergency_requests(request):
    if request.method != 'GET':
        return error_response('Method not allowed.', status=405)

    rows = fetch_all(
        """
        SELECT er.id, er.city, er.blood_group, er.units_needed, er.status, er.created_at,
               u.name AS requester_name, u.phone AS requester_phone
        FROM emergency_requests er
        INNER JOIN users u ON u.id = er.requester_id
        ORDER BY er.created_at DESC
        """
    )

    return json_response({'requests': rows})


@csrf_exempt
@auth_required
@require_roles('admin')
def admin_update_user_role(request, user_id):
    if request.method != 'PUT':
        return error_response('Method not allowed.', status=405)

    data = parse_json(request)
    role = data.get('role')

    if role not in USER_ROLES:
        return error_response('Invalid role.', status=400)

    user = User.objects.filter(id=user_id).first()
    if not user:
        return error_response('User not found.', status=404)

    user.role = role
    user.save(update_fields=['role'])
    return json_response({'message': 'User role updated.'})


@csrf_exempt
def spa_index(request, path=None):
    if request.path.startswith('/api/'):
        return error_response('Not found.', status=404)

    index_path = Path(settings.BASE_DIR) / 'client' / 'dist' / 'index.html'
    if not index_path.exists():
        return error_response('Client build not found. Run npm run client:build first.', status=503)

    return FileResponse(open(index_path, 'rb'), content_type='text/html')

