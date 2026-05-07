package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.WorkspaceMembership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceMembershipRepository extends JpaRepository<WorkspaceMembership, UUID> {

    Optional<WorkspaceMembership> findByMembershipIdAndWorkspaceIdAndStatus(
            UUID membershipId, UUID workspaceId, String status);

    List<WorkspaceMembership> findByMembershipIdAndStatus(UUID membershipId, String status);

    /** All active members of a workspace — used for listing. */
    List<WorkspaceMembership> findByWorkspaceIdAndStatus(UUID workspaceId, String status);

    /** All workspace memberships for a membership (all workspaces across a tenant). */
    List<WorkspaceMembership> findByMembershipId(UUID membershipId);

    Optional<WorkspaceMembership> findByMembershipIdAndWorkspaceId(UUID membershipId, UUID workspaceId);
}
