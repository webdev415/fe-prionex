import { describe, it, expect } from 'vitest'
import { mockUsers } from './users'

describe('Mock Users Data', () => {
  it('should export mockUsers array', () => {
    expect(mockUsers).toBeDefined()
    expect(Array.isArray(mockUsers)).toBe(true)
  })

  it('should contain 12 users as per requirements', () => {
    expect(mockUsers).toHaveLength(12)
  })

  it('should have users with correct structure', () => {
    const user = mockUsers[0]

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

  it('should have at least one Admin user', () => {
    const adminUsers = mockUsers.filter((u) => u.role === 'Admin')
    expect(adminUsers.length).toBeGreaterThan(0)
  })

  it('should have at least one Supervisor user', () => {
    const supervisors = mockUsers.filter((u) => u.role === 'Supervisor')
    expect(supervisors.length).toBeGreaterThan(0)
  })

  it('should have at least one Operator user', () => {
    const operators = mockUsers.filter((u) => u.role === 'Operator')
    expect(operators.length).toBeGreaterThan(0)
  })

  it('should have at least one Active user', () => {
    const activeUsers = mockUsers.filter((u) => u.status === 'Active')
    expect(activeUsers.length).toBeGreaterThan(0)
  })

  it('should have at least one Disabled user', () => {
    const disabledUsers = mockUsers.filter((u) => u.status === 'Disabled')
    expect(disabledUsers.length).toBeGreaterThan(0)
  })

  it('should have at least one user with "all" projects', () => {
    const usersWithAll = mockUsers.filter((u) => u.projects === 'all')
    expect(usersWithAll.length).toBeGreaterThan(0)
  })

  it('should have at least one user with project array', () => {
    const usersWithProjects = mockUsers.filter((u) => Array.isArray(u.projects))
    expect(usersWithProjects.length).toBeGreaterThan(0)
  })

  it('should have valid email formats', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    mockUsers.forEach((user) => {
      expect(emailRegex.test(user.email)).toBe(true)
    })
  })

  it('should have valid phone number formats', () => {
    const phoneRegex = /^\+\d{1,3}-\d{3}-\d{4}$/
    mockUsers.forEach((user) => {
      expect(phoneRegex.test(user.phoneNumber)).toBe(true)
    })
  })

  it('should have unique IDs', () => {
    const ids = mockUsers.map((u) => u.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(mockUsers.length)
  })

  it('should have unique emails', () => {
    const emails = mockUsers.map((u) => u.email)
    const uniqueEmails = new Set(emails)
    expect(uniqueEmails.size).toBe(mockUsers.length)
  })
})
