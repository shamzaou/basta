# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
import json
from .models import User

@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return JsonResponse({
                'status': 'error',
                'message': 'Email and password are required.'
            }, status=400)
        
        # Since we're using email as USERNAME_FIELD
        user = authenticate(request, username=email, password=password)
        
        if user is not None:
            login(request, user)
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'profile_picture': user.profile_picture.url if user.profile_picture else None,
                }
            })
        else:
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
            print(f"User created successfully with ID: {user.id}")
            
            # Now try to log in
            login(request, user)
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