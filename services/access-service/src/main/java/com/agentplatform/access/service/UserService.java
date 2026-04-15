package com.agentplatform.access.service;

import com.agentplatform.access.dto.ChangePasswordRequest;
import com.agentplatform.access.dto.MembershipResponse;
import com.agentplatform.access.dto.UpdateUserRequest;
import com.agentplatform.access.dto.UserResponse;
import com.agentplatform.access.entity.User;
import com.agentplatform.access.exception.AppException;
import com.agentplatform.access.repository.MembershipRepository;
import com.agentplatform.access.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final MembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;

    public Page<UserResponse> listUsers(String search, Pageable pageable) {
        if (search == null || search.isBlank()) {
            return userRepository.findAll(pageable).map(UserResponse::from);
        }
        return userRepository.search(search, pageable).map(UserResponse::from);
    }

    public UserResponse getUser(UUID id) {
        return UserResponse.from(findOrThrow(id));
    }

    @Transactional
    public UserResponse updateUser(UUID id, UpdateUserRequest req) {
        User user = findOrThrow(id);
        if (req.getName() != null) user.setName(req.getName());
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        if (req.getAvatarUrl() != null) user.setAvatarUrl(req.getAvatarUrl());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void changePassword(UUID id, ChangePasswordRequest req) {
        User user = findOrThrow(id);
        if (user.getPasswordHash() == null ||
                !passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new AppException(HttpStatus.NOT_FOUND, "User not found");
        }
        userRepository.deleteById(id);
    }

    public List<MembershipResponse> getUserMemberships(UUID id) {
        User user = findOrThrow(id);
        return membershipRepository.findByUser(user).stream()
                .map(MembershipResponse::from)
                .toList();
    }

    private User findOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
