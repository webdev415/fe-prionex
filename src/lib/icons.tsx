/**
 * Icons Utility
 *
 * Centralized icon exports using Hugeicons.
 * Import icons from this file for consistent usage across the app.
 */

/* eslint-disable react-refresh/only-export-components */
import { HugeiconsIcon } from '@hugeicons/react'
import type { ComponentProps } from 'react'

// Import commonly used icons
import {
  Notification03Icon,
  AiPhone01Icon,
  Calendar01Icon,
  UserGroupIcon,
  Folder01Icon,
  Shield01Icon,
  SecurityValidationIcon,
  ContactIcon,
  Settings01Icon,
  InformationCircleIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Alert02Icon,
  Add01Icon,
  Edit01Icon,
  PencilEdit01Icon,
  Delete01Icon,
  Delete02Icon,
  Search01Icon,
  FilterIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  EyeIcon,
  ViewIcon,
  LockIcon,
  CircleUnlock01Icon,
  UserIcon,
  Mail01Icon,
  Home01Icon,
  Logout01Icon,
  // Sidebar icons
  Menu11Icon,
  Home04Icon,
  Activity01Icon,
  FileImportIcon,
  Analytics01Icon,
  UserGroupIcon as CommunityIcon,
  UserStatusIcon,
  TransactionHistoryIcon,
  Setting07Icon,
  LogoutSquare01Icon,
  UserCircle02Icon,
  ChartRingIcon,
  // Additional icons for UI enhancements
  MultiplicationSignIcon,
  Download01Icon,
  File01Icon,
  ArrowRight02Icon,
  Tick01Icon,
  CloudDownloadIcon,
  FileDownloadIcon,
  ArrowLeft02Icon,
  FileRemoveIcon,
  Csv02Icon,
  Sorting01Icon,
} from '@hugeicons/core-free-icons'
/**
 * Icon component props
 */
export interface IconProps extends ComponentProps<typeof HugeiconsIcon> {
  size?: number
  color?: string
  strokeWidth?: number
}

/**
 * Icon component wrapper with default props
 */
export function Icon({
  icon,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} {...props} />
  )
}

/**
 * Pre-configured icon components for common use cases
 */
export const Icons = {
  // Navigation
  Bell: (props: Omit<IconProps, 'icon'>) => <Icon icon={Notification03Icon} {...props} />,
  Phone: (props: Omit<IconProps, 'icon'>) => <Icon icon={AiPhone01Icon} {...props} />,
  Calendar: (props: Omit<IconProps, 'icon'>) => <Icon icon={Calendar01Icon} {...props} />,
  Users: (props: Omit<IconProps, 'icon'>) => <Icon icon={UserGroupIcon} {...props} />,
  Folder: (props: Omit<IconProps, 'icon'>) => <Icon icon={Folder01Icon} {...props} />,
  Shield: (props: Omit<IconProps, 'icon'>) => <Icon icon={Shield01Icon} {...props} />,
  SecurityValidation: (props: Omit<IconProps, 'icon'>) => (
    <Icon icon={SecurityValidationIcon} {...props} />
  ),
  Contact: (props: Omit<IconProps, 'icon'>) => <Icon icon={ContactIcon} {...props} />,
  Settings: (props: Omit<IconProps, 'icon'>) => <Icon icon={Settings01Icon} {...props} />,
  Home: (props: Omit<IconProps, 'icon'>) => <Icon icon={Home01Icon} {...props} />,
  Sorting01Icon: (props: Omit<IconProps, 'icon'>) => <Icon icon={Sorting01Icon} {...props} />,

  // Actions
  Add: (props: Omit<IconProps, 'icon'>) => <Icon icon={Add01Icon} {...props} />,
  Edit: (props: Omit<IconProps, 'icon'>) => <Icon icon={Edit01Icon} {...props} />,
  PencilEdit: (props: Omit<IconProps, 'icon'>) => <Icon icon={PencilEdit01Icon} {...props} />,
  Delete: (props: Omit<IconProps, 'icon'>) => <Icon icon={Delete02Icon} {...props} />,
  Search: (props: Omit<IconProps, 'icon'>) => <Icon icon={Search01Icon} {...props} />,
  Filter: (props: Omit<IconProps, 'icon'>) => <Icon icon={FilterIcon} {...props} />,
  Eye: (props: Omit<IconProps, 'icon'>) => <Icon icon={EyeIcon} {...props} />,
  View: (props: Omit<IconProps, 'icon'>) => <Icon icon={ViewIcon} {...props} />,

  // Status
  Info: (props: Omit<IconProps, 'icon'>) => <Icon icon={InformationCircleIcon} {...props} />,
  Success: (props: Omit<IconProps, 'icon'>) => <Icon icon={CheckmarkCircle02Icon} {...props} />,
  Error: (props: Omit<IconProps, 'icon'>) => <Icon icon={Delete01Icon} {...props} />,
  Warning: (props: Omit<IconProps, 'icon'>) => <Icon icon={Alert02Icon} {...props} />,

  // Navigation arrows
  ArrowLeft: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowLeft01Icon} {...props} />,
  ArrowRight: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowRight01Icon} {...props} />,
  ArrowDown: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowDown01Icon} {...props} />,
  ArrowUp: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowUp01Icon} {...props} />,
  // Checkmark (using CheckmarkCircle02Icon)
  Checkmark: (props: Omit<IconProps, 'icon'>) => <Icon icon={CheckmarkCircle02Icon} {...props} />,

  // Auth
  Lock: (props: Omit<IconProps, 'icon'>) => <Icon icon={LockIcon} {...props} />,
  LockedIcon01: (props: Omit<IconProps, 'icon'>) => <Icon icon={LockIcon} {...props} />,
  Unlock: (props: Omit<IconProps, 'icon'>) => <Icon icon={CircleUnlock01Icon} {...props} />,
  User: (props: Omit<IconProps, 'icon'>) => <Icon icon={UserIcon} {...props} />,
  User02: (props: Omit<IconProps, 'icon'>) => <Icon icon={UserIcon} {...props} />, // Using UserIcon as User02Icon doesn't exist
  Mail: (props: Omit<IconProps, 'icon'>) => <Icon icon={Mail01Icon} {...props} />,
  Logout: (props: Omit<IconProps, 'icon'>) => <Icon icon={Logout01Icon} {...props} />,

  // Sidebar icons
  Menu11: (props: Omit<IconProps, 'icon'>) => <Icon icon={Menu11Icon} {...props} />,
  Home04: (props: Omit<IconProps, 'icon'>) => <Icon icon={Home04Icon} {...props} />,
  Activity01: (props: Omit<IconProps, 'icon'>) => <Icon icon={Activity01Icon} {...props} />,
  FileImport: (props: Omit<IconProps, 'icon'>) => <Icon icon={FileImportIcon} {...props} />,
  Analytics01: (props: Omit<IconProps, 'icon'>) => <Icon icon={Analytics01Icon} {...props} />,
  Community: (props: Omit<IconProps, 'icon'>) => <Icon icon={CommunityIcon} {...props} />,
  UserStatus: (props: Omit<IconProps, 'icon'>) => <Icon icon={UserStatusIcon} {...props} />,
  TransactionHistory: (props: Omit<IconProps, 'icon'>) => (
    <Icon icon={TransactionHistoryIcon} {...props} />
  ),
  Setting07: (props: Omit<IconProps, 'icon'>) => <Icon icon={Setting07Icon} {...props} />,
  LogoutSquare01: (props: Omit<IconProps, 'icon'>) => <Icon icon={LogoutSquare01Icon} {...props} />,
  ChartRing: (props: Omit<IconProps, 'icon'>) => <Icon icon={ChartRingIcon} {...props} />,

  UserCircle02Icon: (props: Omit<IconProps, 'icon'>) => <Icon icon={UserCircle02Icon} {...props} />,

  // Additional icons for UI enhancements
  Close: (props: Omit<IconProps, 'icon'>) => <Icon icon={MultiplicationSignIcon} {...props} />,
  Download: (props: Omit<IconProps, 'icon'>) => <Icon icon={Download01Icon} {...props} />,
  File: (props: Omit<IconProps, 'icon'>) => <Icon icon={File01Icon} {...props} />,
  ArrowRight02: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowRight02Icon} {...props} />,
  Tick01: (props: Omit<IconProps, 'icon'>) => <Icon icon={Tick01Icon} {...props} />,
  CloudDownload: (props: Omit<IconProps, 'icon'>) => <Icon icon={CloudDownloadIcon} {...props} />,
  FileDownload: (props: Omit<IconProps, 'icon'>) => <Icon icon={FileDownloadIcon} {...props} />,
  ArrowLeft02: (props: Omit<IconProps, 'icon'>) => <Icon icon={ArrowLeft02Icon} {...props} />,
  FileRemove: (props: Omit<IconProps, 'icon'>) => <Icon icon={FileRemoveIcon} {...props} />,
  Csv02: (props: Omit<IconProps, 'icon'>) => <Icon icon={Csv02Icon} {...props} />,
}

/**
 * Export raw icon components for advanced usage
 */
export {
  Notification03Icon,
  AiPhone01Icon,
  Calendar01Icon,
  UserGroupIcon,
  Folder01Icon,
  Shield01Icon,
  SecurityValidationIcon,
  ContactIcon,
  Settings01Icon,
  InformationCircleIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Alert02Icon,
  Add01Icon,
  Edit01Icon,
  PencilEdit01Icon,
  Delete01Icon,
  Delete02Icon,
  Search01Icon,
  FilterIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  EyeIcon,
  ViewIcon,
  LockIcon,
  CircleUnlock01Icon,
  UserIcon,
  Mail01Icon,
  Home01Icon,
  Logout01Icon,
  // Sidebar icons
  Menu11Icon,
  Home04Icon,
  Activity01Icon,
  FileImportIcon,
  Analytics01Icon,
  CommunityIcon,
  UserStatusIcon,
  TransactionHistoryIcon,
  Setting07Icon,
  LogoutSquare01Icon,
  ChartRingIcon,
  Sorting01Icon,
  UserCircle02Icon,
  ArrowRight02Icon,
  Tick01Icon,
  CloudDownloadIcon,
  FileDownloadIcon,
  ArrowLeft02Icon,
  FileRemoveIcon,
  Csv02Icon,
}

/**
 * Export HugeiconsIcon for direct usage when needed
 */
export { HugeiconsIcon }
