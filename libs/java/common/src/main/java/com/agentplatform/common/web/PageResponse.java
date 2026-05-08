package com.agentplatform.common.web;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

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
@Schema(description = "Paginated response wrapper")
public class PageResponse<T> {

    @Schema(description = "Items in the current page")
    private final List<T> items;

    @Schema(description = "Total number of items across all pages", example = "120")
    private final long totalItems;

    @Schema(description = "Total number of pages", example = "12")
    private final int totalPages;

    @Schema(description = "Current page index (0-based)", example = "0")
    private final int page;

    @Schema(description = "Page size", example = "10")
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

    public static <S, T> PageResponse<T> of(Page<S> page, Function<S, T> mapper) {
        return PageResponse.<T>builder()
                .items(page.getContent().stream().map(mapper).toList())
                .totalItems(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .page(page.getNumber())
                .size(page.getSize())
                .build();
    }
}
