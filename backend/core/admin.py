from django.contrib import admin
from .models import (
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

admin.site.register(User)
admin.site.register(BloodBank)
admin.site.register(BloodStock)
admin.site.register(Booking)
admin.site.register(EmergencyRequest)
admin.site.register(EmergencyResponse)
admin.site.register(Notification)
admin.site.register(FavoriteBloodBank)
admin.site.register(StockAlertSubscription)

