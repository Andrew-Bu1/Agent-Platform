from locust import HttpUser, between, task

from tests.load.aihub import config
from tests.load.aihub.tasks.embedding import EmbeddingTasks
from tests.load.aihub.tasks.rerank import RerankTasks


class AihubEmbedUser(HttpUser):
    """
    Simulates a client that exclusively calls the embedding endpoint.
    Use this user class to stress-test embedding in isolation.
    """

    host = config.HOST
    wait_time = between(config.WAIT_MIN, config.WAIT_MAX)
    tasks = {EmbeddingTasks: 1}
    weight = config.EMBED_TASK_WEIGHT


class AihubRerankUser(HttpUser):
    """
    Simulates a client that exclusively calls the rerank endpoint.
    Use this user class to stress-test reranking in isolation.
    """

    host = config.HOST
    wait_time = between(config.WAIT_MIN, config.WAIT_MAX)
    tasks = {RerankTasks: 1}
    weight = config.RERANK_TASK_WEIGHT


class AihubMixedUser(HttpUser):
    """
    Simulates a realistic client that calls both embedding and rerank,
    weighted by EMBED_TASK_WEIGHT / RERANK_TASK_WEIGHT.
    Delegates to EmbeddingTasks / RerankTasks — same logic as the focused users.
    """

    host = config.HOST
    wait_time = between(config.WAIT_MIN, config.WAIT_MAX)
    weight = 1
    tasks = {
        EmbeddingTasks: config.EMBED_TASK_WEIGHT,
        RerankTasks: config.RERANK_TASK_WEIGHT,
    }
