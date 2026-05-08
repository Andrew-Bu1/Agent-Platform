from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class CallerContext:
    subject: str          # userId (user) or clientId string (service_client)
    tenant_id: UUID
    workspace_id: UUID | None
    caller_type: str      # "user" | "service_client"
    bearer_token: str     # original token, forwarded to IAM for entitlement fetch
    permissions: list[str] = field(default_factory=list)

    @property
    def user_id(self) -> UUID | None:
        return UUID(self.subject) if self.caller_type == "user" else None

    @property
    def service_client_id(self) -> str | None:
        return self.subject if self.caller_type == "service_client" else None
