# userapp/urls.py
from django.urls import path
from . import views
from userapp.views import register_view, check_auth

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('check-auth/', views.check_auth, name='check_auth'),
    path('api/auth/register/', register_view, name='register'),
    path('api/auth/check-auth/', check_auth, name='check-auth'),
]