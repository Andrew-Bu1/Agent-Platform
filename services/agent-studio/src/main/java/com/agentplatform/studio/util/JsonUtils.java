package com.agentplatform.studio.util;

import com.fasterxml.jackson.databind.JsonNode;

public final class JsonUtils {

    private JsonUtils() {}

    /** Converts a JsonNode to its JSON string, or returns the fallback if null. */
    public static String toStringOrDefault(JsonNode node, String fallback) {
        return node != null ? node.toString() : fallback;
    }

    public static String toString(JsonNode node) {
        return node != null ? node.toString() : null;
    }
}
