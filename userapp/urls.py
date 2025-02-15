# userapp/urls.py
from django.urls import path, include
from . import views
from userapp.views import register_view, check_auth, redirect_uri, oauth_callback

# urlpatterns = [
#     path('login/', views.login_view, name='login'),
#     path('register/', views.register_view, name='register'),
#     path('logout/', views.logout_view, name='logout'),
#     path('check-auth/', views.check_auth, name='check_auth'),
#     path('api/auth/register/', register_view, name='register'),
#     path('api/auth/check-auth/', check_auth, name='check-auth'),
#     path('redirect_uri/', redirect_uri, name='redirect_uri'), # OAuth redirection
#     path('api/oauth_callback/', oauth_callback, name='oauth_callback'),
#     # path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
#     # path('api/verify-otp/', verify_otp_view, name='verify_otp'),
#     # path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
# ]

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('check-auth/', views.check_auth, name='check_auth'),
    path('redirect_uri/', redirect_uri, name='redirect_uri'),  # OAuth redirection
    path('oauth_callback/', oauth_callback, name='oauth_callback'),
    # path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'), # 2FA
    # path('verify-otp/', verify_otp_view, name='verify_otp'),  
    # path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
