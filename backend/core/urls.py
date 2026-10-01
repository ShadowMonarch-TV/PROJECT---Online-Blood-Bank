from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health),
    path('meta/blood-groups', views.blood_groups),
    path('meta/compatibility/<str:blood_group>', views.compatibility),

    path('auth/register', views.register),
    path('auth/login', views.login),
    path('auth/me', views.me),
    path('auth/profile', views.update_profile),
    path('auth/change-password', views.change_password),

    path('blood/search', views.blood_search),

    path('favorites/my', views.favorites_my),
    path('favorites', views.favorites_add),
    path('favorites/<int:bank_id>', views.favorites_remove),

    path('alerts/subscribe', views.alerts_subscribe),
    path('alerts/my', views.alerts_my),
    path('alerts/<int:alert_id>/status', views.alerts_update_status),
    path('alerts/<int:alert_id>', views.alerts_delete),

    path('bookings', views.bookings_create),
    path('bookings/my', views.bookings_my),
    path('bookings/<int:booking_id>/cancel', views.bookings_cancel),

    path('emergency-requests', views.emergency_create),
    path('emergency-requests/my', views.emergency_my),
    path('emergency-requests/my/responses', views.emergency_my_responses),
    path('emergency-requests/<int:request_id>/close', views.emergency_close),

    path('donor/availability', views.donor_availability),
    path('donor/requests', views.donor_requests),
    path('donor/requests/<int:request_id>/respond', views.donor_respond),
    path('donor/requests/<int:request_id>/withdraw', views.donor_withdraw),
    path('donor/responses', views.donor_responses),

    path('blood-bank/stock', views.bank_stock),
    path('blood-bank/low-stock', views.bank_low_stock),
    path('blood-bank/stock/<str:blood_group>', views.bank_update_stock),
    path('blood-bank/bookings', views.bank_bookings),
    path('blood-bank/bookings/<int:booking_id>', views.bank_bookings_update),
    path('blood-bank/analytics', views.bank_analytics),

    path('notifications/my', views.notifications_my),
    path('notifications/unread-count', views.notifications_unread_count),
    path('notifications/<int:notification_id>/read', views.notifications_mark_read),
    path('notifications/read-all', views.notifications_mark_all),

    path('admin/low-stock', views.admin_low_stock),
    path('admin/analytics/summary', views.admin_analytics_summary),
    path('admin/stats', views.admin_stats),
    path('admin/users', views.admin_users),
    path('admin/blood-banks', views.admin_blood_banks),
    path('admin/bookings', views.admin_bookings),
    path('admin/emergency-requests', views.admin_emergency_requests),
    path('admin/users/<int:user_id>/role', views.admin_update_user_role),

    path('activity/my', views.activity_my)
]
