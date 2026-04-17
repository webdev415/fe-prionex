/**
 * Cascading dictionary picker — operator drills down the tree and
 * picks a leaf node as the interaction result.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TADictionaryNode } from '@/features/taDictionary/api/types'

interface Props {
  nodes: TADictionaryNode[]
  onSelect: (leaf: TADictionaryNode) => void
  selectedId: number | null
}

export function DictionaryPicker({ nodes, onSelect, selectedId }: Props) {
  const { t } = useTranslation('common')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: TADictionaryNode, depth: number) => {
    if (node.is_hidden) return null
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedId === node.id

    return (
      <li key={node.id} className="flex flex-col">
        <div
          className={`flex cursor-pointer items-center gap-2 rounded py-1.5 pr-2 transition-colors ${
            isSelected ? 'bg-primary-300/20 font-medium' : 'hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (node.is_leaf) {
              onSelect(node)
            } else {
              toggle(node.id)
            }
          }}
        >
          {!node.is_leaf ? (
            <span className="w-4 text-[10px] text-gray-500">{isExpanded ? '▼' : '▶'}</span>
          ) : (
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                node.is_positive ? 'bg-green-500' : 'bg-red-400'
              }`}
            />
          )}
          <span
            className={`text-sm ${node.is_leaf ? 'text-gray-700' : 'font-semibold text-gray-800'}`}
          >
            {node.name}
          </span>
          {node.is_leaf && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
              {t('pages.taDictionary.leaf')}
            </span>
          )}
        </div>
        {!node.is_leaf && isExpanded && node.children.length > 0 && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-white p-1">
      <ul>{nodes.map((n) => renderNode(n, 0))}</ul>
    </div>
  )
}
