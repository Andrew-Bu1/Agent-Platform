package com.agentplatform.access.repository;

import com.agentplatform.access.entity.MembershipRole;
import com.agentplatform.access.entity.MembershipRole.MembershipRoleId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MembershipRoleRepository extends JpaRepository<MembershipRole, MembershipRoleId> {

    @Query("SELECT mr FROM MembershipRole mr WHERE mr.membership.id = :membershipId")
    List<MembershipRole> findByMembershipId(@Param("membershipId") UUID membershipId);

    boolean existsByMembership_IdAndRole_Id(UUID membershipId, UUID roleId);

    void deleteByMembership_IdAndRole_Id(UUID membershipId, UUID roleId);
}
