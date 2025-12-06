import { describe, it, expect } from 'vitest'
import type { User, UserRole, UserStatus, Project } from './user'

describe('User Types', () => {
  describe('UserRole', () => {
    it('should allow valid user roles', () => {
      const adminRole: UserRole = 'Admin'
      const supervisorRole: UserRole = 'Supervisor'
      const operatorRole: UserRole = 'Operator'

      expect(adminRole).toBe('Admin')
      expect(supervisorRole).toBe('Supervisor')
      expect(operatorRole).toBe('Operator')
    })
  })

  describe('UserStatus', () => {
    it('should allow valid user statuses', () => {
      const activeStatus: UserStatus = 'Active'
      const disabledStatus: UserStatus = 'Disabled'

      expect(activeStatus).toBe('Active')
      expect(disabledStatus).toBe('Disabled')
    })
  })

  describe('Project', () => {
    it('should have correct structure', () => {
      const project: Project = {
        id: 'p1',
        name: 'FinanceHub',
        slug: 'financehub',
      }

      expect(project).toHaveProperty('id')
      expect(project).toHaveProperty('name')
      expect(project).toHaveProperty('slug')
    })
  })

  describe('User', () => {
    it('should have all required fields', () => {
      const user: User = {
        id: '1',
        username: 'Veronica Denise Lane',
        email: 'veronica.lane@prionex.com',
        phoneNumber: '+1-555-0101',
        role: 'Admin',
        projects: 'all',
        status: 'Active',
        createdAt: '2025-01-15T10:00:00Z',
        lastLogin: '2025-12-03T09:30:00Z',
      }

      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('username')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('phoneNumber')
      expect(user).toHaveProperty('role')
      expect(user).toHaveProperty('projects')
      expect(user).toHaveProperty('status')
      expect(user).toHaveProperty('createdAt')
      expect(user).toHaveProperty('lastLogin')
    })

    it('should allow projects as array', () => {
      const user: User = {
        id: '2',
        username: 'Alexandra Allen',
        email: 'alexandra.allen@prionex.com',
        phoneNumber: '+1-555-0102',
        role: 'Supervisor',
        projects: [
          { id: 'p1', name: 'FinanceHub', slug: 'financehub' },
          { id: 'p2', name: 'MicroCredits', slug: 'microcredits' },
        ],
        status: 'Disabled',
        createdAt: '2025-01-20T14:30:00Z',
        lastLogin: '2025-11-28T16:45:00Z',
      }

      expect(Array.isArray(user.projects)).toBe(true)
    })

    it('should allow projects as "all" string', () => {
      const user: User = {
        id: '1',
        username: 'Admin User',
        email: 'admin@prionex.com',
        phoneNumber: '+1-555-0100',
        role: 'Admin',
        projects: 'all',
        status: 'Active',
        createdAt: '2025-01-01T00:00:00Z',
        lastLogin: '2025-12-03T10:00:00Z',
      }

      expect(user.projects).toBe('all')
    })

    it('should allow lastLogin to be null', () => {
      const user: User = {
        id: '3',
        username: 'New User',
        email: 'new.user@prionex.com',
        phoneNumber: '+1-555-0103',
        role: 'Operator',
        projects: [],
        status: 'Active',
        createdAt: '2025-12-03T12:00:00Z',
        lastLogin: null,
      }

      expect(user.lastLogin).toBeNull()
    })
  })
})
