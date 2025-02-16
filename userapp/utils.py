from functools import wraps
from django.http import JsonResponse
import jwt
from django.conf import settings

def jwt_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse({"error": "Missing or invalid token"}, status=401)

        token = auth_header.split(" ")[1]
        try:
            decoded_token = jwt.decode(token, settings.JWT_SETTINGS["JWT_SECRET_KEY"], algorithms=[settings.JWT_SETTINGS["JWT_ALGORITHM"]])
            request.user_id = decoded_token["user_id"]
            request.username = decoded_token["username"]
        except jwt.ExpiredSignatureError:
            return JsonResponse({"error": "Token expired"}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({"error": "Invalid token"}, status=401)

        return view_func(request, *args, **kwargs)

    return wrapper