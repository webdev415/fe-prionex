/**
 * ProjectTags Component
 *
 * Displays user's assigned projects as tags with overflow handling.
 * - Shows first 3 projects as individual tags
 * - Shows "+ X more" badge if more than 3 projects
 * - Shows "(All 5)" for users with access to all projects
 *
 * @example
 * <ProjectTags projects={[project1, project2]} />
 * <ProjectTags projects="all" />
 */

import type { Project } from '@/types/user'

interface ProjectTagsProps {
  /** Projects assigned to user, or 'all' for admin access */
  projects: Project[] | 'all'
}

export function ProjectTags({ projects }: ProjectTagsProps) {
  // Handle "all" projects case
  if (projects === 'all') {
    return (
      <div className="flex flex-wrap gap-1.5" role="list">
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-medium text-gray-600">
          (All 5)
        </span>
      </div>
    )
  }

  // Handle empty projects
  if (projects.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5" role="list">
        <span className="text-xs text-gray-500">No projects</span>
      </div>
    )
  }

  // Show all projects (design shows them inline)
  return (
    <div className="flex flex-wrap gap-1.5" role="list">
      {projects.map((project) => (
        <span
          key={project.id}
          className="inline-flex items-center text-xs font-medium text-gray-700"
          role="listitem"
        >
          {project.name}
        </span>
      ))}
    </div>
  )
}

export default ProjectTags
