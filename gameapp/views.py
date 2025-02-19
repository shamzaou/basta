# gameapp/views.py
from django.shortcuts import render
from django.http import JsonResponse

def index(request):
    """Main entry point - handles both full page and SPA requests"""
    # Check if this is an AJAX request
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'status': 'success'})
    return render(request, 'frontend/index.html')