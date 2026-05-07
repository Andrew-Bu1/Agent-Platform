package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.WorkspaceMembershipRole;
import com.agentplatform.iam.entity.WorkspaceMembershipRoleId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WorkspaceMembershipRoleRepository
        extends JpaRepository<WorkspaceMembershipRole, WorkspaceMembershipRoleId> {

    List<WorkspaceMembershipRole> findByIdWorkspaceMembershipId(UUID workspaceMembershipId);

    /** Batch load: all workspace role assignments for a list of workspace memberships. */
    List<WorkspaceMembershipRole> findByIdWorkspaceMembershipIdIn(List<UUID> workspaceMembershipIds);

    /** Remove all role assignments when a workspace member is removed. */
    @Modifying
    @Query("DELETE FROM WorkspaceMembershipRole wmr WHERE wmr.id.workspaceMembershipId = :wmId")
    void deleteAllByWorkspaceMembershipId(@Param("wmId") UUID workspaceMembershipId);
}
