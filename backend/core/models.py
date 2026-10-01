from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

ROLE_CHOICES = [
    ('user', 'User'),
    ('donor', 'Donor'),
    ('blood_bank', 'Blood Bank'),
    ('admin', 'Admin')
]


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    blood_group = models.CharField(max_length=4, blank=True, null=True)
    city = models.CharField(max_length=120, blank=True, null=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f'{self.name} ({self.email})'


class BloodBank(models.Model):
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120)
    contact = models.CharField(max_length=120)
    owner_user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, related_name='owned_bank')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blood_banks'

    def __str__(self):
        return self.name


class BloodStock(models.Model):
    bank = models.ForeignKey(BloodBank, on_delete=models.CASCADE, related_name='stock')
    blood_group = models.CharField(max_length=4)
    units_available = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'blood_stock'
        unique_together = ('bank', 'blood_group')


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    bank = models.ForeignKey(BloodBank, on_delete=models.CASCADE, related_name='bookings')
    blood_group = models.CharField(max_length=4)
    units_required = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bookings'


class EmergencyRequest(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed')
    ]

    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emergency_requests')
    city = models.CharField(max_length=120, blank=True, null=True)
    blood_group = models.CharField(max_length=4)
    units_needed = models.IntegerField()
    message = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'emergency_requests'


class EmergencyResponse(models.Model):
    STATUS_CHOICES = [
        ('accepted', 'Accepted'),
        ('withdrawn', 'Withdrawn')
    ]

    emergency_request = models.ForeignKey(EmergencyRequest, on_delete=models.CASCADE, related_name='responses')
    donor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emergency_responses')
    note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='accepted')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'emergency_responses'
        unique_together = ('emergency_request', 'donor')


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    body = models.TextField()
    related_type = models.CharField(max_length=60, blank=True, null=True)
    related_id = models.IntegerField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'


class FavoriteBloodBank(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    bank = models.ForeignKey(BloodBank, on_delete=models.CASCADE, related_name='favorites')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'favorite_blood_banks'
        unique_together = ('user', 'bank')


class StockAlertSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stock_alerts')
    blood_group = models.CharField(max_length=4)
    city = models.CharField(max_length=120, default='', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_notified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'stock_alert_subscriptions'
        unique_together = ('user', 'blood_group', 'city')

