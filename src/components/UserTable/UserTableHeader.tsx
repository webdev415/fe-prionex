/**
 * UserTableHeader Component
 *
 * Renders the table header row with column titles.
 * - Displays all column headers: Username, Email, Phone Number, Role, Projects, Status, Actions
 * - Styled with gray background and uppercase text
 *
 * @example
 * <table>
 *   <thead>
 *     <UserTableHeader />
 *   </thead>
 *   <tbody>...</tbody>
 * </table>
 */

export function UserTableHeader() {
  const columns = ['Username', 'Role', 'Status', 'Actions']

  return (
    <tr className="border-b bg-gray-100/50">
      {columns.map((column) => (
        <th
          key={column}
          scope="col"
          className="px-6 py-3 text-left text-sm font-medium text-gray-900"
        >
          {column}
        </th>
      ))}
    </tr>
  )
}

export default UserTableHeader
