# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.authtoken.models import Token  # Add this import
import json
from .models import User
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
import base64
from django.core.files.base import ContentFile
from rest_framework.authentication import SessionAuthentication, TokenAuthentication


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication, SessionAuthentication])
def profile_view(request):
    """Get user profile information"""
    if request.method == 'GET':
        try:
            user = request.user
            return Response({
                'username': user.username,
                'email': user.email,
                'display_name': user.username,
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
            
            # Handle display_name update
            if 'display_name' in data:
                display_name = data['display_name'].strip()
                if display_name:
                    # Update username as display_name
                    if User.objects.exclude(pk=user.pk).filter(username=display_name).exists():
                        return Response({
                            'status': 'error',
                            'message': 'Display name already taken'
                        }, status=400)
                    user.username = display_name
            
            user.save()
            return Response({
                'status': 'success',
                'username': user.username,
                'email': user.email,
                'display_name': user.username
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
        email = data.get('email')
        password = data.get('password')
        
        print(f"Login attempt for email: {email}")  # Debug log
        
        if not email or not password:
            return JsonResponse({
                'status': 'error',
                'message': 'Email and password are required.'
            }, status=400)
        
        # Since we're using email as USERNAME_FIELD
        user = authenticate(request, username=email, password=password)
        
        if user is not None:
            login(request, user)
            # Always create a new token on login
            Token.objects.filter(user=user).delete()  # Delete existing tokens
            token = Token.objects.create(user=user)
            
            print(f"User {email} logged in successfully, token: {token.key}")  # Debug log
            
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'profile_picture': user.profile_picture.url if user.profile_picture else None,
                },
                'token': token.key  # Always include the token
            })
        else:
            print(f"Authentication failed for email: {email}")  # Debug log
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid email or password.'
            }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid request format.'
        }, status=400)
    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug log
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
        

@ensure_csrf_cookie
@require_POST
def register_view(request):
    try:
        # Debug request content
        print("Request content type:", request.content_type)
        print("Raw request body:", request.body)
        
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password1')
        password2 = data.get('password2')
        username = data.get('username')
        
        print(f"Registration attempt - Data received: {data}")
        
        # Validate all required fields with specific error messages
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
        
        try:
            # Create user without logging in first to test creation
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            user.save()
            print(f"User created successfully with ID: {user.id}")
            
            # Now try to log in
            login(request, user)
            request.session.save() # this is for the refresh login problem
            print("User logged in successfully")
            
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email
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

@ensure_csrf_cookie
def check_auth(request):
    return JsonResponse({
        'isAuthenticated': request.user.is_authenticated,
        'user': {
            'username': request.user.username,
            'email': request.user.email,
        } if request.user.is_authenticated else None
    })

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