class StripApiTrailingSlashMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path_info.startswith('/api/') and request.path_info != '/api/' and request.path_info.endswith('/'):
            request.path_info = request.path_info.rstrip('/')
            request.path = request.path_info
        return self.get_response(request)