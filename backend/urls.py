# backend/urls.py
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from gameapp.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('userapp.urls')),
    path('tournaments/', include('tournaments.urls')),
    # Keep your catch-all route at the end
    re_path(r'^.*$', index, name='index'),
]

# This is crucial for serving media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)