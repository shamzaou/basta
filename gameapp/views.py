from django.shortcuts import render

def index(request, *args, **kwargs):
    """Single view to serve our SPA"""
    return render(request, 'frontend/index.html')