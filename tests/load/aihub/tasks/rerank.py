"""
Locust TaskSet for the POST /v1/rerank endpoint.
"""

import random
import logging

from locust import TaskSet, task

from tests.load.aihub import config
from tests.load.aihub.fixtures.texts import RERANK_QUERIES, RERANK_DOCUMENT_SETS

logger = logging.getLogger(__name__)


class RerankTasks(TaskSet):
    """
    Exercises the rerank endpoint by pairing random queries with random
    document sets, optionally applying a top_n cut-off.
    """

    @task(2)
    def rerank_no_top_n(self) -> None:
        """Rerank all documents (no top_n limit)."""
        self._post_rerank(top_n=None)

    @task
    def rerank_with_top_n(self) -> None:
        """Rerank with a top_n limit to simulate paginated retrieval."""
        top_n = config.RERANK_TOP_N or random.choice([3, 5])
        self._post_rerank(top_n=top_n)

    def _post_rerank(self, top_n: int | None) -> None:
        query = random.choice(RERANK_QUERIES)
        documents = random.choice(RERANK_DOCUMENT_SETS)

        body: dict = {
            "model": random.choice(config.RERANK_MODELS),
            "query": query,
            "documents": documents,
        }
        if top_n is not None:
            body["top_n"] = top_n

        expected_count = top_n if top_n is not None else len(documents)

        with self.client.post(
            "/v1/rerank",
            json=body,
            name="/v1/rerank",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if "results" not in data or not isinstance(data["results"], list):
                    resp.failure(f"Unexpected response shape: {resp.text[:200]}")
                elif len(data["results"]) != expected_count:
                    resp.failure(
                        f"Expected {expected_count} results, got {len(data['results'])}"
                    )
                else:
                    resp.success()
            else:
                resp.failure(
                    f"POST /v1/rerank returned {resp.status_code}: {resp.text[:200]}"
                )
