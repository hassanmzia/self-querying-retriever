"""
Custom pagination class that returns the format expected by the frontend.

Frontend expects: { data: [...], total, page, page_size, total_pages }
DRF default returns: { count, next, previous, results: [...] }
"""

import math

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class FrontendPagination(PageNumberPagination):
    page_size_query_param = "page_size"

    def get_paginated_response(self, data):
        total = self.page.paginator.count
        page_size = self.get_page_size(self.request) or self.page_size
        return Response(
            {
                "data": data,
                "total": total,
                "page": self.page.number,
                "page_size": page_size,
                "total_pages": math.ceil(total / page_size) if page_size else 1,
            }
        )
