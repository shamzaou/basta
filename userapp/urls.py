# userapp/urls.py
from django.urls import path
from . import views

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('check-auth/', views.check_auth, name='check_auth'),
    path('redirect_uri/', views.redirect_uri, name='redirect_uri'),
    path('oauth_callback/', views.oauth_callback, name='oauth_callback'),
    path('get-token/', views.get_token, name='get_token'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
