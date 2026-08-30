# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate, get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt

from decouple import config

from rest_framework.authtoken.models import Token  # Add this import
from rest_framework_simplejwt.tokens import RefreshToken

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
from django.utils import timezone
from .models import User, MatchHistory

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
import base64
import io
from django.core.files.base import ContentFile
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
import uuid

import os
import re
import mimetypes
import threading
from django.http import HttpResponse, FileResponse
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import IntegrityError

logger = logging.getLogger(__name__)


def send_otp_email_async(user, otp):
    """Send the 2FA code in a background thread so the login request returns at once.

    The SMTP round-trip to Gmail used to run inside the request (several seconds, and a
    500 when it failed). Failures are logged instead of surfaced to the user; the code
    stays valid in the cache so a retry/resend simply re-mails the same code.
    """
    ttl_minutes = getattr(settings, 'OTP_TTL_SECONDS', 600) // 60

    def _send():
        try:
            send_mail(
                "Your Login OTP",
                f"Your OTP for login is: {otp}\nValid for {ttl_minutes} minutes.",
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Failed to send OTP email to user id=%s", user.id)

    thread = threading.Thread(target=_send, name=f"otp-mail-{user.id}", daemon=True)
    thread.start()
    return thread



@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def profile_view(request):
    if request.method == 'GET':
        try:
            user = request.user
            
            # Exclude tournament games from both match history and statistics
            match_history = MatchHistory.objects.filter(user=user).exclude(game_type='TOURNAMENT').order_by('-date_played')[:5]
            
            # Calculate statistics excluding tournament games
            total_matches = MatchHistory.objects.filter(user=user).exclude(game_type='TOURNAMENT').count()
            wins = MatchHistory.objects.filter(user=user, result='WIN').exclude(game_type='TOURNAMENT').count()
            win_rate = int((wins / total_matches) * 100) if total_matches > 0 else 0
            
            # Find best score from wins, excluding tournament matches
            best_score = "0-0"
            if wins > 0:
                best_score_matches = MatchHistory.objects.filter(user=user, result='WIN').exclude(game_type='TOURNAMENT')
                if best_score_matches.exists():
                    # Find match with biggest score difference
                    best_match = None
                    biggest_diff = -1
                    for match in best_score_matches:
                        scores = match.score.split('-')
                        if len(scores) == 2:
                            try:
                                user_score = int(scores[0])
                                opp_score = int(scores[1])
                                diff = user_score - opp_score
                                if diff > biggest_diff:
                                    biggest_diff = diff
                                    best_match = match
                            except ValueError:
                                continue
                    
                    if best_match:
                        best_score = best_match.score
            
            # Format match history for response
            matches = []
            for match in match_history:
                matches.append({
                    'opponent': match.opponent,
                    'score': match.score,
                    'result': match.result,
                    'date': match.date_played.isoformat(),
                    'game_type': match.game_type  # Ensure game_type is included
                })
                
            return Response({
                'username': user.username,
                'email': user.email,
                'display_name': user.display_name if hasattr(user, 'display_name') else user.username,
                'avatar': user.profile_picture.url if user.profile_picture else None,
                'date_joined': user.date_joined.strftime('%B %Y'),
                'two_factor_enabled': user.two_factor_enabled,
                'stats': {
                    'games_played': total_matches,
                    'win_rate': f"{win_rate}%",
                    'best_score': best_score
                },
                'match_history': matches
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
                new_email = str(data['email']).strip().lower()
                try:
                    validate_email(new_email)
                except ValidationError:
                    return Response({'status': 'error', 'message': 'Invalid email address'}, status=400)
                if User.objects.exclude(pk=user.pk).filter(email__iexact=new_email).exists():
                    return Response({
                        'status': 'error',
                        'message': 'Email already taken'
                    }, status=400)
                user.email = new_email

            # 2FA can be switched on/off from the settings page
            if 'two_factor_enabled' in data:
                user.two_factor_enabled = data['two_factor_enabled'] in (True, 'true', 'True', 1, '1')
            
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
                        ext = format.split('/')[-1].lower()
                        if ext == 'jpeg':
                            ext = 'jpg'
                        if ext not in ('png', 'jpg', 'gif', 'webp'):
                            return Response({'status': 'error', 'message': 'Unsupported image type (use PNG, JPG, GIF or WEBP)'}, status=400)
                        raw = base64.b64decode(imgstr)
                        if len(raw) > 2 * 1024 * 1024:
                            return Response({'status': 'error', 'message': 'Image too large (max 2 MB)'}, status=400)
                        try:
                            from PIL import Image
                            Image.open(io.BytesIO(raw)).verify()
                        except Exception:
                            return Response({'status': 'error', 'message': 'Invalid image'}, status=400)
                        # upload_to='profile_pictures/' already adds the directory
                        filename = f'user_{user.id}.{ext}'
                        data = ContentFile(raw)
                        user.profile_picture.save(filename, data, save=True)
                except Exception as e:
                    logger.warning("Error handling profile picture: %s", e)
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
                'avatar': user.profile_picture.url if user.profile_picture else None,
                'two_factor_enabled': user.two_factor_enabled
            })
        except Exception as e:
            logger.warning("Error updating profile: %s", e)
            return Response({
                'status': 'error',
                'message': 'Failed to update profile'
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
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")

        if not email or not password:
            return JsonResponse({"status": "error", "message": "Email and password are required."}, status=400)

        user = authenticate(username=email, password=password)

        if not user:
            return JsonResponse({"status": "error", "message": "Invalid email or password."}, status=400)

        if user.two_factor_enabled:
            # Handle 2FA before issuing tokens.
            # Re-use a still-valid code if one exists: clicking "Sign In" again while
            # waiting for a slow email must not invalidate the code already sent.
            cache_key = f"otp_{user.id}"
            otp = cache.get(cache_key)
            if not otp:
                otp = str(random.randint(100000, 999999))
                cache.set(cache_key, otp, timeout=getattr(settings, 'OTP_TTL_SECONDS', 600))

            send_otp_email_async(user, otp)

            return JsonResponse({
                "status": "success",
                "requires_2fa": True,
                "message": "Please check your email for OTP"
            })

        # Normal login (no 2FA)
        login(request, user)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return JsonResponse({
            "status": "success",
            "requires_2fa": False,
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": {  # Make sure to include user ID
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "profile_picture": user.profile_picture.url if user.profile_picture else None,
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON format"}, status=400)
    except Exception:
        logger.exception("Login failed")
        return JsonResponse({"status": "error", "message": "Login failed"}, status=500)

@require_POST
def verify_otp(request):
    try:
        data = json.loads(request.body)
        email = (data.get("email") or "").strip().lower()
        # Normalise: the frontend sends a string, but tolerate numbers and pasted whitespace
        otp = str(data.get("otp") or "").strip()

        if not email or not otp:
            return JsonResponse({
                "status": "error",
                "message": "Email and OTP are required"
            }, status=400)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return JsonResponse({
                "status": "error",
                "message": "User not found"
            }, status=404)

        cache_key = f"otp_{user.id}"
        cached_otp = cache.get(cache_key)

        if cached_otp and str(cached_otp) == otp:
            # Login the user
            login(request, user)
            
            # Create auth token
            Token.objects.filter(user=user).delete()
            token = Token.objects.create(user=user)
            refresh = RefreshToken.for_user(user)

            # Clear the OTP
            cache.delete(cache_key)

            return JsonResponse({
                "status": "success",
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
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
    except Exception:
        logger.exception("OTP verification error")
        return JsonResponse({
            "status": "error",
            "message": "OTP verification failed"
        }, status=500)

@ensure_csrf_cookie
def register_view(request):
    if request.method == 'GET':
        return JsonResponse({'status': 'ok'})  # Just for CSRF cookie
        
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            email = (data.get('email') or '').strip().lower()
            password1 = data.get('password1')
            password2 = data.get('password2')
            username = (data.get('username') or '').strip()
            enable_2fa = data.get('enable_2fa', False) in (True, 'true', 'True', 1, '1')
        
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
                validate_email(email)
            except ValidationError:
                return JsonResponse({'status': 'error', 'message': 'Invalid email address'}, status=400)
            if User.objects.filter(email__iexact=email).exists():
                return JsonResponse({'status': 'error', 'message': 'Email already registered'}, status=400)
            if User.objects.filter(username__iexact=username).exists():
                return JsonResponse({'status': 'error', 'message': 'Username already taken'}, status=400)

            try:
                # Import password validators to check password strength
                from django.contrib.auth.password_validation import validate_password

                # Validate password strength (pass the unsaved user so the
                # username/email similarity validator actually runs)
                try:
                    validate_password(password1, user=User(username=username, email=email))
                except ValidationError as e:
                    # Return validation errors as a list
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Password validation failed',
                        'errors': list(e.messages)
                    }, status=400)
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password1,
                    two_factor_enabled=enable_2fa
                )
                user.save()

                # Now try to log in
                login(request, user)
                request.session.save() # this is for the refresh login problem
                
                return JsonResponse({
                    'status': 'success',
                    'message': 'Registration successful',
                    'user': {
                        'username': user.username,
                        'email': user.email,
                        'two_factor_enabled': user.two_factor_enabled
                    }
                })
                
            except IntegrityError:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Email or username already in use'
                }, status=400)
            except Exception as user_error:
                logger.exception("Error creating user")
                return JsonResponse({
                    'status': 'error',
                    'message': 'User creation failed'
                }, status=500)

        except json.JSONDecodeError:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid JSON format'
            }, status=400)
        except Exception:
            logger.exception("Unexpected registration error")
            return JsonResponse({
                'status': 'error',
                'message': 'Registration failed'
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
            
            oauth_link = (
                f"https://api.intra.42.fr/oauth/authorize"
                f"?client_id={client_id}"
                f"&redirect_uri={redirect_uri}"
                f"&response_type=code"
            )

            return JsonResponse({"oauth_link": oauth_link})
        except Exception as e:
            print("Error in redirect_uri:", str(e))
            return JsonResponse({"error": f"Exception: {str(e)}"}, status=500)
    return JsonResponse({'error': "Method not allowed"}, status=405)

@csrf_exempt
def oauth_callback(request):
    error = request.GET.get('error')
    if error:
        return redirect("https://localhost:443/login")

    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "Authorization code not provided"}, status=400)

    try:
        token_url = "https://api.intra.42.fr/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "https://localhost:443/home",
            "client_id": settings.FORTYTWO_CLIENT_ID,
            "client_secret": settings.FORTYTWO_CLIENT_SECRET,
        }
        
        response = requests.post(token_url, data=payload)
        if response.status_code != 200:
            return redirect("https://localhost:443/login")

        access_token = response.json().get("access_token")

        user_info_url = "https://api.intra.42.fr/v2/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_response = requests.get(user_info_url, headers=headers)

        if user_info_response.status_code != 200:
            return redirect("https://localhost:443/login")

        user_info = user_info_response.json()
        username = user_info.get("login")
        email = user_info.get("email")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': username, 'is_42_user': True, 'intra_id': user_info.get('id')}
        )

        login(request, user)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        response = redirect("https://localhost:443/home")
        response.set_cookie(
            'jwt_token',
            str(refresh.access_token),
            max_age=86400,
            httponly=True,
            samesite='Lax',
            secure=True
        )
        response.set_cookie(
            'refresh_token',
            str(refresh),
            max_age=604800,
            httponly=True,
            samesite='Lax',
            secure=True
        )

        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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


        # Get or create user
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': username, 'is_42_user': True, 'intra_id': fortytwo_id}
        )

        # Ensure intra_id is saved for new users
        if created:
            user.intra_id = fortytwo_id
            user.save()

        # Log the user in
        login(request, user)

        # Generate JWT tokens using Simple JWT
        refresh = RefreshToken.for_user(user)

        # Return tokens and user data
        return JsonResponse({
            "status": "success",
            "access_token": str(refresh.access_token),  # Use this in frontend requests
            "refresh_token": str(refresh),  # Store this to refresh access tokens
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "profile_picture": user.profile_picture.url if user.profile_picture else None,
            }
        })

    except Exception as e:
        print(f"Error in get_token: {str(e)}")
        return JsonResponse({'error': f'Authentication failed: {str(e)}'}, status=500)


@api_view(['POST'])
def verify_otp_view(request):
    username = request.data.get('username')
    otp = request.data.get('otp')

    if not username or not otp:
        return Response({"error": "Username and OTP are required."}, status=400)

    try:
        user = User.objects.get(username=username)
        cache_key = f"otp_{user.id}"
        cached_otp = cache.get(cache_key)

        if cached_otp == otp:
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "OTP verified successfully.",
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh)
            }, status=200)
        else:
            return Response({"error": "Invalid OTP."}, status=400)

    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=404)

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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def match_history_view(request):
    """Get user's match history"""
    user = request.user
    matches = MatchHistory.objects.filter(user=user).order_by('-date_played')[:10]  # Limit to 10 most recent
    
    match_data = []
    for match in matches:
        match_info = {
            'id': match.id,
            'game_type': match.game_type,
            'opponent': match.opponent,
            'result': match.result,
            'score': match.score,
            'date': match.date_played.isoformat()
        }
        
        # Include metadata for tournament matches
        if match.game_type == 'TOURNAMENT' and hasattr(match, 'metadata') and match.metadata:
            match_info['metadata'] = match.metadata
            
        match_data.append(match_info)
    
    return Response({
        'match_history': match_data
    })

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_match_view(request):
    """Save a new match result"""
    user = request.user
    data = request.data

    try:
        # Extract match data
        game_type = data.get('game_type', 'PONG')  # Default to PONG 5 specified
        opponent = str(data.get('opponent', 'Unknown'))[:150]
        result = data.get('result', 'DRAW')
        score = str(data.get('score', '0-0'))

        # Validate against the model choices so stats can't be skewed by bad input
        if game_type not in dict(MatchHistory.GAME_CHOICES) and game_type != 'TOURNAMENT':
            return Response({'status': 'error', 'message': 'Invalid match data'}, status=status.HTTP_400_BAD_REQUEST)
        if result not in dict(MatchHistory.RESULT_CHOICES) or not re.fullmatch(r'\d{1,4}-\d{1,4}', score):
            return Response({'status': 'error', 'message': 'Invalid match data'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle tournament-specific data
        tournament_id = data.get('tournament_id')
        match_id = data.get('match_id')
        
        # Create the match history entry
        match = MatchHistory(
            user=user,
            game_type=game_type,
            opponent=opponent,
            result=result,
            score=score
        )
        
        # If this is a tournament match, add additional metadata
        if game_type == 'TOURNAMENT' and tournament_id:
            # Create a proper metadata dictionary
            match.metadata = {
                'tournament_id': tournament_id,
                'match_id': match_id
            }
            
        match.save()
        
        return Response({'status': 'success'}, status=status.HTTP_201_CREATED)

    except Exception:
        logger.exception("save_match failed")
        return Response({
            'status': 'error',
            'message': 'Failed to save match'
        }, status=status.HTTP_400_BAD_REQUEST)

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_match(request):
    """
    Initializes a new Tic-Tac-Toe match and returns a match_id.
    """
    try:
        if not request.user.is_authenticated:
            return Response({'error': 'User not authenticated'}, status=401)

        match_id = str(uuid.uuid4())  # Generate a unique match ID

        return Response({'match_id': match_id, 'opponent': 'AI'}, status=201)

    except Exception as e:
        logger.exception("create_match failed")
        return Response({'error': 'Failed to create match'}, status=500)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    try:
        user = request.user
        user.delete()
        return Response({'status': 'success', 'message': 'Account deleted successfully'})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

# Clean up get_avatar_image view function by removing unnecessary debug logs
@api_view(['GET'])
def get_avatar_image(request, user_id):
    """Serve user avatar directly"""
    try:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        
        if user.profile_picture:
            # Get the actual file path
            file_path = user.profile_picture.path
            
            # Check if file exists
            if os.path.exists(file_path):
                # Determine content type based on file extension
                content_type = mimetypes.guess_type(file_path)[0] or 'image/jpeg'
                
                # Use Django's FileResponse for better performance
                return FileResponse(open(file_path, 'rb'), content_type=content_type)
        
        # Return default avatar if no custom avatar or file not found
        default_avatar_path = os.path.join(settings.BASE_DIR, 'static', 'frontend', 'assets', 'man.png')
        
        if os.path.exists(default_avatar_path):
            return FileResponse(open(default_avatar_path, 'rb'), content_type='image/png')
        else:
            return Response({"error": "Avatar not found"}, status=404)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def debug_avatar_path(request, user_id):
    """Debug helper to check avatar paths"""
    try:
        user = User.objects.get(id=user_id)
        
        response_data = {
            "user_id": user_id,
            "username": user.username,
        }
        
        if user.profile_picture:
            response_data.update({
                "has_profile_picture": True,
                "profile_picture_url": user.profile_picture.url,
                "profile_picture_path": user.profile_picture.path,
                "file_exists": os.path.exists(user.profile_picture.path)
            })
        else:
            response_data["has_profile_picture"] = False
            
        # Check the MEDIA_ROOT and URL settings
        response_data["media_root"] = settings.MEDIA_ROOT
        response_data["media_url"] = settings.MEDIA_URL
        
        return Response(response_data)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# Add the user data export view
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_user_data(request):
    """Export all user data in a structured format"""
    try:
        user = request.user
        
        # Get user's match history
        match_history = MatchHistory.objects.filter(user=user).order_by('-date_played')
        
        # Calculate statistics
        total_matches = match_history.count()
        wins = match_history.filter(result='WIN').count()
        losses = match_history.filter(result='LOSS').count()
        draws = match_history.filter(result='DRAW').count()
        win_rate = int((wins / total_matches) * 100) if total_matches > 0 else 0
        
        # Format match history for response
        matches = []
        for match in match_history:
            matches.append({
                'id': match.id,
                'game_type': match.game_type,
                'opponent': match.opponent,
                'score': match.score,
                'result': match.result,
                'date_played': match.date_played.isoformat(),
            })
        
        # Build comprehensive user data
        user_data = {
            'user_information': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'display_name': user.display_name if hasattr(user, 'display_name') else user.username,
                'date_joined': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'is_42_user': user.is_42_user if hasattr(user, 'is_42_user') else False,
            },
            'profile': {
                'avatar_url': user.profile_picture.url if user.profile_picture else None,
            },
            'statistics': {
                'games_played': total_matches,
                'wins': wins,
                'losses': losses,
                'draws': draws,
                'win_rate': f"{win_rate}%",
            },
            'match_history': matches,
            'export_date': timezone.now().isoformat(),
        }
        
        return Response(user_data)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_users(request):
    """Get list of all users except the current user"""
    try:
        # Exclude current user and maybe some system users
        users = User.objects.exclude(id=request.user.id).exclude(is_superuser=True).filter(is_active=True)
        
        # Check which users are friends with the current user
        user_friends_ids = request.user.friends.values_list('id', flat=True)
        
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'display_name': user.display_name if hasattr(user, 'display_name') else user.username,
                'avatar': user.profile_picture.url if user.profile_picture else None,
                'is_friend': user.id in user_friends_ids
            })
        
        return Response({
            'users': users_data
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friends(request):
    """Get list of user's friends"""
    try:
        friends = request.user.friends.all()
        friends_data = []
        
        for friend in friends:
            friends_data.append({
                'id': friend.id,
                'username': friend.username,
                'display_name': friend.display_name if hasattr(friend, 'display_name') else friend.username,
                # 'avatar': friend.profile_picture.url if friend.profile_picture else None
            })
        
        return Response({
            'friends': friends_data
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_friend(request, user_id):
    """Add a user as friend"""
    try:
        friend = User.objects.get(id=user_id)
        user = request.user
        
        result = user.add_friend(friend)
        
        if result:
            return Response({
                'status': 'success',
                'message': f'Added {friend.username} as friend'
            })
        else:
            return Response({
                'status': 'error',
                'message': 'Could not add friend'
            }, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_friend(request, user_id):
    """Remove a user from friends"""
    try:
        friend = User.objects.get(id=user_id)
        user = request.user
        
        result = user.remove_friend(friend)
        
        if result:
            return Response({
                'status': 'success',
                'message': f'Removed {friend.username} from friends'
            })
        else:
            return Response({
                'status': 'error',
                'message': 'Could not remove friend'
            }, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)