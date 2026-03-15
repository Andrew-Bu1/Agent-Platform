import random
import logging

from locust import TaskSet, task

from tests.load.aihub import config
from tests.load.aihub.fixtures.texts import EMBED_INPUTS

logger = logging.getLogger(__name__)


class EmbeddingTasks(TaskSet):
    """
    Exercises the embedding endpoint with varied batches of text inputs.

    Each task pick picks a random payload from EMBED_INPUTS so the server
    sees a realistic mix of single-string and batch requests.
    """

    @task
    def embed_single(self) -> None:
        """Send a single-string embedding request."""
        payload = random.choice([inp for inp in EMBED_INPUTS if len(inp) == 1])
        self._post_embed(payload)

    @task(2)
    def embed_batch(self) -> None:
        """Send a multi-string batch embedding request."""
        batches = [inp for inp in EMBED_INPUTS if len(inp) > 1]
        payload = random.choice(batches)
        self._post_embed(payload)

    def _post_embed(self, inputs: list[str]) -> None:
        body = {
            "model": random.choice(config.EMBED_MODELS),
            "input": inputs,
        }
        with self.client.post(
            "/v1/embed",
            json=body,
            name="/v1/embed",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if "data" not in data or not isinstance(data["data"], list):
                    resp.failure(f"Unexpected response shape: {resp.text[:200]}")
                elif len(data["data"]) != len(inputs):
                    resp.failure(
                        f"Expected {len(inputs)} embeddings, got {len(data['data'])}"
                    )
                else:
                    resp.success()
            else:
                resp.failure(
                    f"POST /v1/embed returned {resp.status_code}: {resp.text[:200]}"
                )
