from django.urls import path, include
from core.views import spa_index

urlpatterns = [
    path('api/', include('core.urls')),
    path('', spa_index),
    path('<path:path>', spa_index)
]

