from django.contrib import admin
from django.urls import path, re_path  # Add re_path
from django.conf import settings
from django.conf.urls.static import static
from gameapp.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index, name='home'),
    # Instead of individual paths, catch all URLs and let the frontend router handle them
    re_path(r'^.*$', index, name='index'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)