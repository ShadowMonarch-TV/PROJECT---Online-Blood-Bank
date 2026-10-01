from django.db.models.signals import post_migrate
from django.dispatch import receiver
from .models import User, BloodBank, BloodStock, BLOOD_GROUPS


@receiver(post_migrate)
def seed_initial_data(sender, **kwargs):
    if sender.name != 'core':
        return

    if not User.objects.filter(role='admin').exists():
        User.objects.create_user(
            email='admin@bloodbank.com',
            password='Admin@123',
            name='System Admin',
            phone='9999999999',
            role='admin',
            city='Bengaluru',
            is_available=False,
            is_staff=True
        )

    if BloodBank.objects.exists():
        return

    sample_banks = [
        {
            'owner': {
                'name': 'City Care Bank',
                'email': 'citycare@bloodbank.com',
                'phone': '9000000001',
                'city': 'Bengaluru'
            },
            'bank': {
                'name': 'City Care Blood Bank',
                'address': 'MG Road',
                'city': 'Bengaluru',
                'contact': '080-1000001'
            },
            'stock': {'A+': 15, 'A-': 6, 'B+': 18, 'B-': 5, 'AB+': 7, 'AB-': 3, 'O+': 20, 'O-': 4}
        },
        {
            'owner': {
                'name': 'Lifeline Bank',
                'email': 'lifeline@bloodbank.com',
                'phone': '9000000002',
                'city': 'Mysuru'
            },
            'bank': {
                'name': 'Lifeline Blood Bank',
                'address': 'Sayyaji Rao Road',
                'city': 'Mysuru',
                'contact': '0821-2000002'
            },
            'stock': {'A+': 8, 'A-': 2, 'B+': 10, 'B-': 3, 'AB+': 4, 'AB-': 1, 'O+': 14, 'O-': 2}
        }
    ]

    for entry in sample_banks:
        owner = User.objects.create_user(
            email=entry['owner']['email'],
            password='Bank@123',
            name=entry['owner']['name'],
            phone=entry['owner']['phone'],
            role='blood_bank',
            city=entry['owner']['city'],
            is_available=False
        )

        bank = BloodBank.objects.create(
            name=entry['bank']['name'],
            address=entry['bank']['address'],
            city=entry['bank']['city'],
            contact=entry['bank']['contact'],
            owner_user=owner
        )

        for group in BLOOD_GROUPS:
            units = entry['stock'].get(group, 0)
            BloodStock.objects.create(
                bank=bank,
                blood_group=group,
                units_available=units
            )

