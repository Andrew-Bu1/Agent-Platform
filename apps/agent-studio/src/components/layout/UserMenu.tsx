import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronUp, Eye, EyeOff, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { tokenStorage } from '@/lib/api/tokenStorage'
import { usersApi } from '@/lib/api/access'
import { authApi } from '@/lib/api/auth'
import type { MembershipResponse, UserResponse } from '@/lib/api/access-types'

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

function Avatar({ user, size = 'md' }: { user: UserResponse | null; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name ?? user.email}
        className={cn('rounded-full object-cover shrink-0', sz)}
      />
    )
  }
  const label = user ? initials(user.name, user.email) : '?'
  return (
    <div
      className={cn(
        'rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center shrink-0',
        sz,
      )}
    >
      {label}
    </div>
  )
}

// ── Profile Modal ─────────────────────────────────────────────────────────────

type ProfileTab = 'profile' | 'security'

function ProfileModal({
  user,
  onClose,
  onUpdated,
}: {
  user: UserResponse
  onClose: () => void
  onUpdated: (u: UserResponse) => void
}) {
  const [tab, setTab] = useState<ProfileTab>('profile')

  // profile
  const [name, setName] = useState(user.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [secError, setSecError] = useState('')
  const [secLoading, setSecLoading] = useState(false)
  const [secSuccess, setSecSuccess] = useState(false)

  async function saveProfile() {
    setProfileError('')
    setProfileSuccess(false)
    if (!name.trim()) { setProfileError('Name is required'); return }
    setProfileLoading(true)
    try {
      const res = await usersApi.update(user.id, {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      })
      if (res.data) { onUpdated(res.data); setProfileSuccess(true) }
    } catch {
      setProfileError('Failed to update profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  async function savePassword() {
    setSecError('')
    setSecSuccess(false)
    if (!currentPassword) { setSecError('Current password is required'); return }
    if (newPassword.length < 8) { setSecError('New password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setSecError('Passwords do not match'); return }
    setSecLoading(true)
    try {
      await usersApi.changePassword(user.id, { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSecSuccess(true)
    } catch {
      setSecError('Failed to change password. Check your current password.')
    } finally {
      setSecLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Profile & Settings" size="md">
      {/* Tab bar */}
      <div className="-mx-6 -mt-5 mb-5 flex border-b border-gray-200 px-6 dark:border-border-dark">
        {(['profile', 'security'] as ProfileTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
            )}
          >
            {t === 'profile' ? 'Profile' : 'Security'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          {/* Avatar preview + URL */}
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="h-14 w-14 rounded-full object-cover border border-gray-200 dark:border-border-dark shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-brand-600 text-white text-lg font-semibold flex items-center justify-center shrink-0">
                {initials(name, user.email)}
              </div>
            )}
            <div className="flex-1">
              <Input
                label="Avatar URL"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            value={user.email}
            disabled
            hint="Email cannot be changed"
          />

          {profileError && (
            <p className="text-xs text-red-600 dark:text-red-400">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-xs text-green-600 dark:text-green-400">Profile updated.</p>
          )}

          <div className="flex justify-end">
            <Button loading={profileLoading} onClick={() => void saveProfile()}>
              Save Profile
            </Button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <Input
            label="Current Password"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Input
            label="New Password"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="Minimum 8 characters"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {secError && (
            <p className="text-xs text-red-600 dark:text-red-400">{secError}</p>
          )}
          {secSuccess && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Password changed successfully.
            </p>
          )}

          <div className="flex justify-end">
            <Button loading={secLoading} onClick={() => void savePassword()}>
              Change Password
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── UserMenu ──────────────────────────────────────────────────────────────────

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [memberships, setMemberships] = useState<MembershipResponse[]>([])
  const [switching, setSwitching] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const currentTenantId = tokenStorage.getCurrentTenantId()

  useEffect(() => {
    usersApi.getMe()
      .then((r) => {
        if (!r.data) return
        setUser(r.data)
        usersApi.getMemberships(r.data.id)
          .then((mr) => {
            if (mr.data) setMemberships(mr.data.filter((m) => m.status === 'active'))
          })
          .catch(() => { /* non-fatal */ })
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  // close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSwitchTenant(tenantId: string) {
    if (tenantId === currentTenantId) { setOpen(false); return }
    setSwitching(tenantId)
    try {
      const token = tokenStorage.getAccessToken() ?? ''
      const res = await authApi.switchTenant({ tenantId }, token)
      if (res.data) {
        tokenStorage.save(res.data.accessToken, res.data.refreshToken)
        setOpen(false)
        // hard navigate to flush all in-memory state
        window.location.href = '/dashboard'
      }
    } catch {
      // silently ignore — stay on current tenant
    } finally {
      setSwitching(null)
    }
  }

  function handleLogout() {
    tokenStorage.clear()
    navigate('/login')
  }

  const currentTenant = memberships.find((m) => m.tenantId === currentTenantId)

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          collapsed && 'justify-center',
        )}
      >
        <Avatar user={user} size="sm" />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
                {user?.name ?? user?.email ?? '…'}
              </p>
              <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                {currentTenant?.tenantName ?? '—'}
              </p>
            </div>
            <ChevronUp
              size={14}
              className={cn(
                'shrink-0 text-gray-400 transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {/* Dropdown — opens upward */}
      {open && (
        <div
          className={cn(
            'absolute bottom-full mb-2 z-50',
            'rounded-xl border border-gray-200 bg-white shadow-lg',
            'dark:border-border-dark dark:bg-card-dark',
            collapsed ? 'left-full ml-2 w-60' : 'left-0 right-0',
          )}
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-border-dark">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {user?.name ?? '—'}
              </p>
              <p className="truncate text-xs text-gray-400">{user?.email ?? '—'}</p>
            </div>
          </div>

          {/* Tenant switcher */}
          {memberships.length > 0 && (
            <div className="px-2 py-2 border-b border-gray-100 dark:border-border-dark">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Workspaces
              </p>
              {memberships.map((m) => {
                const isActive = m.tenantId === currentTenantId
                const isLoading = switching === m.tenantId
                return (
                  <button
                    key={m.tenantId}
                    onClick={() => void handleSwitchTenant(m.tenantId)}
                    disabled={isLoading}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-60',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                    )}
                  >
                    <Building2 size={14} className="shrink-0" />
                    <span className="flex-1 truncate">{m.tenantName}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                    )}
                    {isLoading && (
                      <span className="text-[10px] text-gray-400 shrink-0">switching…</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Actions */}
          <div className="px-2 py-2">
            <button
              onClick={() => { setOpen(false); setProfileOpen(true) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <User size={14} className="shrink-0" />
              Profile &amp; Settings
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut size={14} className="shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileOpen && user && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onUpdated={(updated) => {
            setUser(updated)
            setProfileOpen(false)
          }}
        />
      )}
    </div>
  )
}
