# gameapp/views.py
from django.shortcuts import render

def index(request):
    # Remove the forced logout to prevent OAuth issues
    return render(request, 'frontend/index.html')