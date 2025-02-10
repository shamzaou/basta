from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required

def login_view(request):
    # Add login logic here
    return render(request, 'frontend/index.html')

def register_view(request):
    # Add registration logic here
    return render(request, 'frontend/index.html')

@login_required
def profile_view(request):
    return render(request, 'frontend/index.html')

@login_required
def settings_view(request):
    return render(request, 'frontend/index.html')