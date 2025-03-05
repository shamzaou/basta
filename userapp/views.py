# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate, get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt

from decouple import config

from rest_framework.authtoken.models import Token  # Add this import

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

import json
import jwt
import datetime
from .models import User

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
import base64
from django.core.files.base import ContentFile
from rest_framework.authentication import SessionAuthentication, TokenAuthentication

logger = logging.getLogger(__name__)



@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def profile_view(request):
    if request.method == 'GET':
        try:
            user = request.user
            return Response({
                'username': user.username,
                'email': user.email,
                'display_name': user.display_name if hasattr(user, 'display_name') else user.username,
                'avatar': user.profile_picture.url if user.profile_picture else None,
                'date_joined': user.date_joined.strftime('%B %Y')
            })
        except Exception as e:
            print(f"Profile view error: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    elif request.method == 'PUT':
        try:
            user = request.user
            data = request.data
            
            if 'username' in data:
                if User.objects.exclude(pk=user.pk).filter(username=data['username']).exists():
                    return Response({
                        'status': 'error',
                        'message': 'Username already taken'
                    }, status=400)
                user.username = data['username']
            
            if 'email' in data:
                if User.objects.exclude(pk=user.pk).filter(email=data['email']).exists():
                    return Response({
                        'status': 'error',
                        'message': 'Email already taken'
                    }, status=400)
                user.email = data['email']
            
            if 'display_name' in data:
                # Direct update of display_name
                User.objects.filter(id=user.id).update(display_name=data['display_name'].strip())
                user.refresh_from_db()
                
            # Handle profile picture upload
            if 'profile_picture' in data:
                try:
                    # Delete old profile picture if it exists
                    if user.profile_picture:
                        default_storage.delete(user.profile_picture.path)
                    
                    # Handle base64 image data
                    if data['profile_picture'].startswith('data:image'):
                        format, imgstr = data['profile_picture'].split(';base64,')
                        ext = format.split('/')[-1]
                        filename = f'profile_pictures/user_{user.id}.{ext}'
                        data = ContentFile(base64.b64decode(imgstr))
                        user.profile_picture.save(filename, data, save=True)
                except Exception as e:
                    print(f"Error handling profile picture: {str(e)}")
                    return Response({
                        'status': 'error',
                        'message': 'Failed to update profile picture'
                    }, status=400)
            
            user.save()
            
            return Response({
                'status': 'success',
                'username': user.username,
                'email': user.email,
                'display_name': user.display_name or user.username,
                'avatar': user.profile_picture.url if user.profile_picture else None
            })
        except Exception as e:
            print(f"Error updating profile: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=400)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update user profile information"""
    user = request.user
    data = request.data
    
    # Handle profile picture upload
    if 'profile_picture' in data:
        # If there's an existing picture, delete it
        if user.profile_picture:
            default_storage.delete(user.profile_picture.path)
        
        # Handle base64 encoded image
        if data['profile_picture'].startswith('data:image'):
            format, imgstr = data['profile_picture'].split(';base64,')
            ext = format.split('/')[-1]
            filename = f'profile_pictures/{user.id}.{ext}'
            data = ContentFile(base64.b64decode(imgstr))
            user.profile_picture.save(filename, data, save=False)

    user.save()
    return Response({
        'status': 'success',
        'user': {
            'username': user.username,
            'email': user.email,
            'avatar': user.profile_picture.url if user.profile_picture else None,
			'display_name': user.username 
        }
    })


@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)

        email = data.get("email")
        password = data.get("password")
        
        print(f"Login attempt for email: {email}")  # Debug log
        
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
                login(request, user)
                Token.objects.filter(user=user).delete()
                token = Token.objects.create(user=user)
                
                return JsonResponse({
                    "status": "success",
                    "requires_2fa": False,
                    "token": token.key,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "username": user.username,
                        "profile_picture": user.profile_picture.url if user.profile_picture else None,
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

        print(f"Verifying OTP - Email: {email}, OTP: {otp}")  # Debug log

        if not email or not otp:
            return JsonResponse({
                "status": "error",
                "message": "Email and OTP are required"
            }, status=400)

        try:
            user = User.objects.get(email=email)
            print(f"Found user: {user.username}")  # Debug log
        except User.DoesNotExist:
            print(f"No user found with email: {email}")  # Debug log
            return JsonResponse({
                "status": "error",
                "message": "User not found"
            }, status=404)

        cache_key = f"otp_{user.id}"
        cached_otp = cache.get(cache_key)
        print(f"Cached OTP: {cached_otp}, Received OTP: {otp}")  # Debug log

        if cached_otp and cached_otp == otp:
            # Login the user
            login(request, user)
            
            # Create auth token
            Token.objects.filter(user=user).delete()
            token = Token.objects.create(user=user)

            # Clear the OTP
            cache.delete(cache_key)

            return JsonResponse({
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "profile_picture": user.profile_picture.url if user.profile_picture else None,
                }
            })
        else:
            return JsonResponse({
                "status": "error",
                "message": "Invalid OTP"
            }, status=400)

    except json.JSONDecodeError:
        return JsonResponse({
            "status": "error",
            "message": "Invalid JSON format"
        }, status=400)
    except Exception as e:
        print(f"OTP verification error: {str(e)}")  # Debug log
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)

@ensure_csrf_cookie
def register_view(request):
    if request.method == 'GET':
        return JsonResponse({'status': 'ok'})  # Just for CSRF cookie
        
    if request.method == 'POST':
        try:
            print("Received registration request")
            print("Headers:", request.headers)
            data = json.loads(request.body)
            print("Request data:", {**data, 'password1': '[HIDDEN]', 'password2': '[HIDDEN]'})
            
            email = data.get('email')
            password1 = data.get('password1')
            password2 = data.get('password2')
            username = data.get('username')
            enable_2fa = data.get('enable_2fa', False)
            
            print(f"Registration attempt - Data received: {data}")
        
            # Validate all required fields
            missing_fields = []
            if not email: missing_fields.append('email')
            if not password1: missing_fields.append('password')
            if not password2: missing_fields.append('password confirmation')
            if not username: missing_fields.append('username')
            
            if missing_fields:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Missing required fields: {", ".join(missing_fields)}'
                }, status=400)
            
            if password1 != password2:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Passwords do not match'
                }, status=400)
                
            try:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password1,
                    two_factor_enabled=enable_2fa
                )
                user.save()
                print(f"User created successfully with ID: {user.id}")
                
                # Now try to log in
                login(request, user)
                request.session.save() # this is for the refresh login problem
                print("User logged in successfully")
                
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

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

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
            # First check if the settings exist
            if not hasattr(settings, 'FORTYTWO_CLIENT_ID') or not hasattr(settings, 'FORTYTWO_REDIRECT_URI'):
                print("ERROR: FORTYTWO_CLIENT_ID or FORTYTWO_REDIRECT_URI not defined in settings")
                return JsonResponse({
                    "error": "OAuth configuration is incomplete. Please check server settings."
                }, status=500)
            
            # Use the FORTYTWO_ prefixed variables for consistency
            client_id = settings.FORTYTWO_CLIENT_ID
            redirect_uri = settings.FORTYTWO_REDIRECT_URI
            
            # Debug output
            print(f"Using client_id: {client_id}")
            print(f"Using redirect_uri: {redirect_uri}")
            
            oauth_link = (
                f"https://api.intra.42.fr/oauth/authorize"
                f"?client_id={client_id}"
                f"&redirect_uri={redirect_uri}"
                f"&response_type=code"
            )
            
            print("Generated OAuth link:", oauth_link)
            
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
        return redirect("https://localhost:443/login")

    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "Authorization code not provided"}, status=400)

    try:
        # Exchange code for access token
        token_url = "https://api.intra.42.fr/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "https://localhost:443/home",
            "client_id": settings.JWT_SETTINGS["CLIENT_ID"],
            "client_secret": settings.JWT_SETTINGS["CLIENT_SECRET"],
        }
        
        response = requests.post(token_url, data=payload)
        
        if response.status_code != 200:
            print("Token exchange failed:", response.text)
            return redirect("https://localhost:443/login")

        access_token = response.json().get("access_token")
        
        # Fetch user info from 42 API
        user_info_url = "https://api.intra.42.fr/v2/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_response = requests.get(user_info_url, headers=headers)
        
        if user_info_response.status_code != 200:
            return redirect("https://localhost:443/login")

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

        # Log the user in
        login(request, user)

        # Create auth token
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)

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

        # Create response with all necessary data
        response = redirect("https://localhost:443/home")
        response.set_cookie(
            'sessionid',
            request.session.session_key,
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=True
        )
        
        response.set_cookie(
            'jwt_token',
            jwt_token,
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=True
        )

        response.set_cookie(
            'auth_token',
            token.key,
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=True
        )

        # Set session data
        request.session['is_authenticated'] = True
        request.session['user_id'] = user.id
        request.session.modified = True

        return response
        
    except Exception as e:
        print("OAuth callback error:", str(e))
        return redirect("https://localhost:443/login")

@csrf_exempt
@require_POST
def get_token(request):
    try:
        # Extract code from request
        body_unicode = request.body.decode('utf-8')
        body_data = json.loads(body_unicode)
        code = body_data.get('code')
        
        if not code:
            return JsonResponse({'error': 'Authorization code is required'}, status=400)
        
        # Debugging: Print settings values to verify they're loaded
        print(f"FORTYTWO_CLIENT_ID: {settings.FORTYTWO_CLIENT_ID}")
        print(f"FORTYTWO_REDIRECT_URI: {settings.FORTYTWO_REDIRECT_URI}")
            
        # Exchange code for access token with 42 API
        token_url = 'https://api.intra.42.fr/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': settings.FORTYTWO_CLIENT_ID,
            'client_secret': settings.FORTYTWO_CLIENT_SECRET,
            'code': code,
            'redirect_uri': settings.FORTYTWO_REDIRECT_URI
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            error_message = f"Token request failed with status {token_response.status_code}: {token_response.text}"
            print(error_message)
            return JsonResponse({'error': error_message}, status=401)
            
        token_json = token_response.json()
        access_token = token_json.get('access_token')
        
        # Get user info from 42 API
        user_url = 'https://api.intra.42.fr/v2/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_url, headers=headers)
        
        if user_response.status_code != 200:
            error_message = f"User data request failed with status {user_response.status_code}: {user_response.text}"
            print(error_message)
            return JsonResponse({'error': error_message}, status=401)
            
        user_data = user_response.json()
        fortytwo_id = user_data.get('id')
        email = user_data.get('email')
        username = user_data.get('login')
        
        print(f"User data received: ID={fortytwo_id}, username={username}, email={email}")
        
        # Get or create user
        User = get_user_model()
        try:
            user = User.objects.get(username=username)
            print(f"Found existing user: {user.username}")
        except User.DoesNotExist:
            print(f"Creating new user with username: {username}")
            user = User.objects.create_user(
                username=username,
                email=email,
            )
            # Store the 42 ID with the user
            user.is_42_user = True
            user.intra_id = fortytwo_id
            user.save()
        
        # Log the user in explicitly
        login(request, user)
        
        # Generate JWT token
        payload = {
            'user_id': user.id,
            'username': user.username,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }
        
        jwt_token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        
        # Create a DRF token for API access
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        
        # Return tokens and user data
        return JsonResponse({
            'token': jwt_token,
            'auth_token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'profile_picture': user.profile_picture.url if user.profile_picture else None,
            }
        })
    
    except Exception as e:
        print(f"Error in get_token: {str(e)}")
        return JsonResponse({'error': f'Authentication failed: {str(e)}'}, status=500)

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

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def user_settings_view(request):
    """Handle user settings get/update"""
    if request.method == 'GET':
        user = request.user
        return Response({
            'username': user.username,
            'email': user.email,
            'display_name': user.get_full_name() or user.username,
            'avatar': user.profile_picture.url if user.profile_picture else None,
        })
    elif request.method == 'PUT':
        user = request.user
        data = request.data
        
        if 'username' in data:
            # Validate username is unique
            if User.objects.exclude(pk=user.pk).filter(username=data['username']).exists():
                return Response({
                    'status': 'error',
                    'message': 'Username already taken'
                }, status=400)
            user.username = data['username']
        
        if 'email' in data:
            user.email = data['email']
            
        if 'display_name' in data:
            names = data['display_name'].split(' ', 1)
            user.first_name = names[0]
            user.last_name = names[1] if len(names) > 1 else ''
        
        user.save()
        return Response({
            'status': 'success',
            'user': {
                'username': user.username,
                'email': user.email,
                'display_name': user.get_full_name() or user.username,
                'avatar': user.profile_picture.url if user.profile_picture else None,
            }
        })

