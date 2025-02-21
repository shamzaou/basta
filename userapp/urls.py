# userapp/urls.py
from django.urls import path
from . import views
from userapp.views import register_view, check_auth

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),
    path('check-auth/', views.check_auth, name='check-auth'),
    path('profile/', views.profile_view, name='profile'),
    path('settings/', views.user_settings_view, name='user-settings'),
    path('delete-account/', views.delete_account, name='delete_account'),
]