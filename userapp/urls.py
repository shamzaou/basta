# userapp/urls.py
from django.urls import path
from . import views

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),


    path('redirect_uri/', views.redirect_uri, name='redirect_uri'),
    path('oauth_callback/', views.oauth_callback, name='oauth_callback'),
    path('get-token/', views.get_token, name='get_token'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('register/', views.register_view, name='register'),
    path('check-auth/', views.check_auth, name='check-auth'),
    path('profile/', views.profile_view, name='profile'),
    path('settings/', views.user_settings_view, name='user-settings'),

    # New match history endpoints
    path('match-history/', views.match_history_view, name='match-history'),
    path('save-match/', views.save_match_view, name='save-match'),
    path('match/create/', views.create_match, name='create-match'),
    path('match/save', views.save_match_view, name='save-match'),

    path('delete-account/', views.delete_account, name='delete-account'),

    # Add direct avatar access
    path('avatar/<int:user_id>/', views.get_avatar_image, name='get-avatar'),

    # Add the debug endpoint
    path('debug-avatar/<int:user_id>/', views.debug_avatar_path, name='debug-avatar-path'),
]

# Add this to your urlpatterns list
urlpatterns += [
    path('export-data/', views.export_user_data, name='export-user-data'),
]

