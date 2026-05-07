package com.agentplatform.iam.repository;

import com.agentplatform.iam.entity.MembershipRole;
import com.agentplatform.iam.entity.MembershipRoleId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MembershipRoleRepository extends JpaRepository<MembershipRole, MembershipRoleId> {

    List<MembershipRole> findByIdMembershipId(UUID membershipId);

    /** Batch load: all role assignments for a list of memberships. */
    List<MembershipRole> findByIdMembershipIdIn(List<UUID> membershipIds);

    /** Remove all role assignments when a member is removed from a tenant. */
    @Modifying
    @Query("DELETE FROM MembershipRole mr WHERE mr.id.membershipId = :membershipId")
    void deleteAllByMembershipId(@Param("membershipId") UUID membershipId);
}
