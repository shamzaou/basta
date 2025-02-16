# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.csrf import csrf_exempt
from decouple import config
import json
import jwt
import datetime
from .models import User
from django.core.mail import send_mail
from django.conf import settings
from .utils import jwt_required
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
import requests
from django.shortcuts import redirect
import random
from django.core.cache import cache
import logging
from rest_framework.decorators import api_view

logger = logging.getLogger(__name__)

@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JsonResponse({"status": "error", "message": "Email and password are required."}, status=400)

        user = authenticate(username=email, password=password)
        
        if not user:
            return JsonResponse({"status": "error", "message": "Invalid email or password."}, status=400)

        # Check if user exists and credentials are valid
        if user:
            # First verify if 2FA is enabled for this user
            if user.two_factor_enabled:
                # Generate and send OTP only after successful password verification
                otp = str(random.randint(100000, 999999))
                cache_key = f"otp_{user.id}"
                cache.set(cache_key, otp, timeout=300)  # 5 minutes

                try:
                    # Send OTP email
                    send_mail(
                        "Your Login OTP",
                        f"Your OTP for login is: {otp}\nValid for 5 minutes.",
                        settings.DEFAULT_FROM_EMAIL,
                        [user.email],
                        fail_silently=False,
                    )
                    print(f"OTP sent to {user.email}: {otp}")  # Debug log
                except Exception as e:
                    print(f"Failed to send OTP email: {str(e)}")
                    return JsonResponse({"status": "error", "message": "Failed to send OTP"}, status=500)

                # Return success but indicate 2FA is required
                return JsonResponse({
                    "status": "success",
                    "requires_2fa": True,
                    "message": "Please check your email for OTP"
                })
            else:
                # No 2FA required, proceed with normal login
                payload = {
                    "user_id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=settings.JWT_SETTINGS["JWT_EXP_DELTA_SECONDS"]),
                    "iat": datetime.datetime.utcnow(),
                }
                token = jwt.encode(payload, settings.JWT_SETTINGS["JWT_SECRET_KEY"], algorithm=settings.JWT_SETTINGS["JWT_ALGORITHM"])

                # Return success with token for immediate login
                return JsonResponse({
                    "status": "success",
                    "requires_2fa": False,  # Explicitly indicate no 2FA
                    "token": token,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "username": user.username
                    }
                })
        
    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug log
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@require_POST
def verify_otp(request):
    try:
        data = json.loads(request.body)
        email = data.get("email")
        otp = data.get("otp")

        user = User.objects.get(email=email)
        cache_key = f"otp_{user.id}"
        cached_otp = cache.get(cache_key)

        if cached_otp and cached_otp == otp:
            # Create JWT token
            payload = {
                "user_id": user.id,
                "email": user.email,
                "username": user.username,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=settings.JWT_SETTINGS["JWT_EXP_DELTA_SECONDS"]),
                "iat": datetime.datetime.utcnow(),
            }
            token = jwt.encode(payload, settings.JWT_SETTINGS["JWT_SECRET_KEY"], algorithm=settings.JWT_SETTINGS["JWT_ALGORITHM"])

            # Clear the OTP
            cache.delete(cache_key)

            return JsonResponse({
                "status": "success",
                "token": token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username
                }
            })
        else:
            return JsonResponse({"status": "error", "message": "Invalid OTP"}, status=400)

    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "User not found"}, status=404)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@ensure_csrf_cookie
@require_POST
def register_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password1')
        password2 = data.get('password2')
        username = data.get('username')
        enable_2fa = data.get('enable_2fa', False)
        
        print(f"Registration attempt - Data received: {data}")
        
        # Validate all required fields
        missing_fields = []
        if not email: missing_fields.append('email')
        if not password: missing_fields.append('password')
        if not password2: missing_fields.append('password confirmation')
        if not username: missing_fields.append('username')
        
        if missing_fields:
            return JsonResponse({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }, status=400)
        
        if password != password2:
            return JsonResponse({
                'status': 'error',
                'message': 'Passwords do not match'
            }, status=400)
            
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                two_factor_enabled=enable_2fa
            )
            print(f"User created successfully with ID: {user.id}")
            
            return JsonResponse({
                'status': 'success',
                'message': 'Registration successful',
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'two_factor_enabled': user.two_factor_enabled
                }
            })
            
        except Exception as user_error:
            print(f"Error creating user: {str(user_error)}")
            return JsonResponse({
                'status': 'error',
                'message': f'User creation failed: {str(user_error)}'
            }, status=500)
            
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Invalid JSON format: {str(e)}'
        }, status=400)
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Registration failed: {str(e)}'
        }, status=500)

@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({'status': 'success'})

@jwt_required
def check_auth(request):
    return JsonResponse({
        "isAuthenticated": True,
        "user": {
            "user_id": request.user_id,
            "username": request.username,
            "email": request.email
        }
    })

@csrf_exempt
def redirect_uri(request):
    if request.method == 'POST':
        try:
            client_id = config('CLIENT_ID')
            redirect_uri = config('REDIRECT_URI')
            
            oauth_link = (
                f"https://api.intra.42.fr/oauth/authorize"
                f"?client_id={client_id}"
                f"&redirect_uri={redirect_uri}"
                f"&response_type=code"
            )
            
            print("Generated OAuth link:", oauth_link)
            print("Client ID:", client_id)
            print("Redirect URI:", redirect_uri)
            
            return JsonResponse({"oauth_link": oauth_link})
        except Exception as e:
            print("Error in redirect_uri:", str(e))
            return JsonResponse({"error": f"Exception: {str(e)}"}, status=500)
    return JsonResponse({'error': "Method not allowed"}, status=405)

@csrf_exempt
def oauth_callback(request):
    error = request.GET.get('error')
    if error:
        print(f"OAuth Error: {error} - {request.GET.get('error_description')}")
        return redirect("http://localhost:8000/login")

    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "Authorization code not provided"}, status=400)

    try:
        # Exchange code for access token
        token_url = "https://api.intra.42.fr/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.JWT_SETTINGS["REDIRECT_URI"],
            "client_id": settings.JWT_SETTINGS["CLIENT_ID"],
            "client_secret": settings.JWT_SETTINGS["CLIENT_SECRET"],
        }
        
        print("Requesting access token with payload:", {
            **payload,
            'client_secret': '[REDACTED]'  # Don't log the secret
        })
        
        response = requests.post(token_url, data=payload)
        print("Token response:", response.text)  # Add this for debugging
        
        if response.status_code != 200:
            print("Token exchange failed:", response.text)
            return redirect("http://localhost:8000/login")

        access_token = response.json().get("access_token")

        # Fetch user info from 42 API
        user_info_url = "https://api.intra.42.fr/v2/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_response = requests.get(user_info_url, headers=headers)
        
        if user_info_response.status_code != 200:
            print("User info fetch failed:", user_info_response.text)
            return redirect("http://localhost:8000/login")

        user_info = user_info_response.json()
        username = user_info.get("login")
        email = user_info.get("email")

        # Create or update user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'is_42_user': True,
                'intra_id': user_info.get('id')
            }
        )

        # Create JWT token
        payload = {
            "user_id": str(user.id),
            "email": email,
            "username": username,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
            "iat": datetime.datetime.utcnow(),
        }
        jwt_token = jwt.encode(
            payload, 
            settings.JWT_SETTINGS["JWT_SECRET_KEY"], 
            algorithm=settings.JWT_SETTINGS["JWT_ALGORITHM"]
        )

        # Store in session
        request.session["jwt_token"] = jwt_token
        request.session.modified = True
        
        print("JWT Token stored in session:", jwt_token)
        print("Session data:", dict(request.session))

        # Create response with session cookie
        response = redirect("http://localhost:8000/home")
        response.set_cookie(
            'sessionid',
            request.session.session_key,
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=False  # Set to True in production with HTTPS
        )
        
        # Set JWT token in cookie as well
        response.set_cookie(
            'jwt_token',
            jwt_token,
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=False  # Set to True in production with HTTPS
        )
        
        return response
        
    except Exception as e:
        print("OAuth callback error:", str(e))
        return redirect("http://localhost:8000/login")

@csrf_exempt
def get_token(request):
    # Try to get token from session first
    token = request.session.get("jwt_token")
    
    # If not in session, try to get from cookie
    if not token:
        token = request.COOKIES.get('jwt_token')
    
    print("Session data:", dict(request.session))
    print("Cookies:", dict(request.COOKIES))
    print("Retrieved token:", token)
    
    if not token:
        return JsonResponse({
            "error": "Not authenticated",
            "debug_info": {
                "session_keys": list(request.session.keys()),
                "cookies": dict(request.COOKIES)
            }
        }, status=401)

    try:
        # Verify the token
        payload = jwt.decode(
            token, 
            settings.JWT_SETTINGS["JWT_SECRET_KEY"],
            algorithms=[settings.JWT_SETTINGS["JWT_ALGORITHM"]]
        )
        return JsonResponse({"token": token})
    except jwt.ExpiredSignatureError:
        return JsonResponse({"error": "Token expired"}, status=401)
    except jwt.InvalidTokenError:
        return JsonResponse({"error": "Invalid token"}, status=401)

@api_view(['POST'])
def verify_otp_view(request):
    username = request.data.get('username')
    otp = request.data.get('otp')

    # Debugging: Log incoming data
    logger.debug(f"Received username: {username}")
    logger.debug(f"Received OTP: {otp}")

    if not username or not otp:
        return Response({"error": "Username and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(username=username)
        cache_key = f"otp_{user.id}"
        cached_otp = cache.get(cache_key)

        # Debugging: Log cached OTP
        logger.debug(f"Cached OTP for user {user.username}: {cached_otp}")

        if cached_otp == otp:
            token = jwt.encode(
                {"username": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)},
                settings.SECRET_KEY,
                algorithm="HS256"
            )
            return Response({"message": "OTP verified successfully.", "token": token}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
