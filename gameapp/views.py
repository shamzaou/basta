# gameapp/views.py
from django.shortcuts import render
from django.contrib.auth import logout

def index(request):
    # Force logout on page load (temporary, for testing)
    logout(request)
    return render(request, 'frontend/index.html')