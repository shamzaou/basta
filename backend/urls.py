# backend/urls.py
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from gameapp.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('userapp.urls')),  # This will include all auth routes
    re_path(r'^.*$', index, name='index'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)