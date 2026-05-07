package com.agentplatform.common.web;

import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Paginated response wrapper, built from a Spring Data {@link Page}.
 *
 * <pre>
 * {
 *   "items": [...],
 *   "totalItems": 120,
 *   "totalPages": 12,
 *   "page": 0,
 *   "size": 10
 * }
 * </pre>
 */
@Getter
@Builder
public class PageResponse<T> {

    private final List<T> items;
    private final long totalItems;
    private final int totalPages;
    private final int page;
    private final int size;

    public static <T> PageResponse<T> of(Page<T> page) {
        return PageResponse.<T>builder()
                .items(page.getContent())
                .totalItems(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .page(page.getNumber())
                .size(page.getSize())
                .build();
    }
}
