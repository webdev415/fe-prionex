/**
 * Recursive tree node — renders a single row in the left panel.
 * Matches the mockup: colored dot, bold name, type badge, children count.
 * Click to select (parent handles selection state).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TADictionaryNode } from '@/features/taDictionary/api/types'

interface Props {
  node: TADictionaryNode
  depth: number
  selectedId: number | null
  onSelect: (node: TADictionaryNode) => void
}

export function DictionaryTreeNode({ node, depth, selectedId, onSelect }: Props) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)

  const isSelected = selectedId === node.id
  const childCount = node.children.length
  const isHidden = node.is_hidden

  // Dot color: green = positive leaf, red = negative leaf, grey = inactive/hidden
  const dotColor = isHidden
    ? 'bg-gray-300'
    : node.is_leaf
      ? node.is_positive
        ? 'bg-green-500'
        : 'bg-red-400'
      : 'bg-gray-400'

  return (
    <li className="flex flex-col select-none">
      <div
        className={`flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 transition-colors ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
        } ${isHidden ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse triangle or leaf dot */}
        {!node.is_leaf ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] text-gray-500"
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
          </span>
        )}

        {/* Name */}
        <span
          className={`text-sm ${isHidden ? 'text-gray-400 italic line-through' : 'text-gray-900'} ${
            !node.is_leaf ? 'font-semibold' : 'font-normal'
          }`}
        >
          {node.name}
        </span>

        {/* Type badge */}
        {node.is_leaf ? (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            {t('pages.taDictionary.leaf')}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">
            {t('pages.taDictionary.intermediate')}
            {childCount > 0 && ` · ${childCount} ${t('pages.taDictionary.childrenSuffix')}`}
          </span>
        )}

        {/* Hidden / inactive badge */}
        {isHidden && (
          <span className="text-[10px] text-gray-400 italic">
            {t('pages.taDictionary.inactive')}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && childCount > 0 && (
        <ul className="flex flex-col">
          {node.children.map((child) => (
            <DictionaryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
