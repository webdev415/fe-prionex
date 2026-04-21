/**
 * TA Dictionary editor page (KAN-327).
 *
 * Two-panel layout matching the mockup:
 *   Left:  "Dictionary tree" — nested tree with colored dots, type badges
 *   Right: "Node settings" — appears when a node is selected
 *
 * Chain picker at the top. "+ Add root node" button top-right of the tree.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useTAChains, useTAChain } from '@/features/taChains/hooks/useTAChains'
import {
  useDictionaryTree,
  useCreateDictionaryNode,
} from '@/features/taDictionary/hooks/useTADictionary'
import type { TADictionaryNode } from '@/features/taDictionary/api/types'
import { DictionaryTreeNode } from './components/DictionaryTreeNode'
import { NodeSettingsPanel } from './components/NodeSettingsPanel'
import { getErrorMessage } from '@/lib/errors'

export function TADictionaryPage() {
  const { t } = useTranslation('common')
  const { data: chainsData, isLoading: chainsLoading } = useTAChains({
    include_inactive: false,
  })
  const chains = chainsData?.items ?? []

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const { data: chainDetail } = useTAChain(selectedChainId)
  const chainSteps = chainDetail?.steps ?? []
  const { data: treeData, isLoading: treeLoading } = useDictionaryTree(selectedChainId)

  const [selectedNode, setSelectedNode] = useState<TADictionaryNode | null>(null)

  // Add root node
  const createMut = useCreateDictionaryNode()
  const [addingRoot, setAddingRoot] = useState(false)
  const [newRootName, setNewRootName] = useState('')
  const [newRootIsLeaf, setNewRootIsLeaf] = useState(false)
  const [newRootStepId, setNewRootStepId] = useState<string>('all')

  const addRoot = async () => {
    if (!newRootName.trim() || selectedChainId === null) return
    try {
      await createMut.mutateAsync({
        chainId: selectedChainId,
        payload: {
          chain_id: selectedChainId,
          step_id: newRootStepId !== 'all' ? parseInt(newRootStepId, 10) : null,
          name: newRootName.trim(),
          is_leaf: newRootIsLeaf,
        },
      })
      setNewRootName('')
      setNewRootIsLeaf(false)
      setNewRootStepId('all')
      setAddingRoot(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Find latest version of selected node from the tree (after mutations)
  const findNode = (nodes: TADictionaryNode[], id: number): TADictionaryNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  const resolvedSelectedNode =
    selectedNode && treeData ? findNode(treeData.nodes, selectedNode.id) : null

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Title */}
      <h1 className="text-dark-500 text-2xl font-light italic">
        {t('pages.taDictionary.pageTitle')}
      </h1>

      {/* Chain picker */}
      <div className="flex w-full flex-col gap-1 sm:max-w-sm">
        <Select
          value={selectedChainId !== null ? String(selectedChainId) : ''}
          onValueChange={(v) => {
            setSelectedChainId(parseInt(v, 10))
            setSelectedNode(null)
          }}
          disabled={chainsLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                chainsLoading ? t('common.loading') : t('pages.taDictionary.selectChainPlaceholder')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {chains.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No chain selected */}
      {selectedChainId === null && (
        <div className="w-full rounded-lg border border-dashed border-gray-300 bg-white/60 p-10 text-center text-base text-gray-600">
          {t('pages.taDictionary.noChainSelected')}
        </div>
      )}

      {/* Loading */}
      {selectedChainId !== null && treeLoading && (
        <div className="text-sm text-gray-500">{t('common.loading')}</div>
      )}

      {/* Two-panel layout */}
      {selectedChainId !== null && !treeLoading && treeData && (
        <div className="flex w-full flex-col gap-4 lg:flex-row">
          {/* ---- LEFT PANEL: Dictionary tree ---- */}
          <div className="flex min-h-[300px] flex-1 flex-col rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-dark-500 text-base font-semibold">
                {t('pages.taDictionary.treeTitle')}
              </h2>
              {!addingRoot && (
                <Button variant="cancel" size="sm" onClick={() => setAddingRoot(true)}>
                  + {t('pages.taDictionary.addRootNode')}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {treeData.nodes.length === 0 && !addingRoot && (
                <div className="p-6 text-center text-sm text-gray-500">
                  {t('pages.taDictionary.emptyTree')}
                </div>
              )}

              <ul className="flex flex-col">
                {treeData.nodes.map((node) => (
                  <DictionaryTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={resolvedSelectedNode?.id ?? null}
                    onSelect={setSelectedNode}
                  />
                ))}
              </ul>

              {/* Add root form */}
              {addingRoot && (
                <div className="mt-2 flex flex-col gap-2 px-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newRootName}
                      onChange={(e) => setNewRootName(e.target.value)}
                      placeholder={t('pages.taDictionary.newNodeName')}
                      className="h-8 w-48 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addRoot()
                        if (e.key === 'Escape') setAddingRoot(false)
                      }}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                    <label className="flex items-center gap-1 text-[10px] whitespace-nowrap text-gray-600">
                      <input
                        type="checkbox"
                        checked={newRootIsLeaf}
                        onChange={(e) => setNewRootIsLeaf(e.target.checked)}
                      />
                      {t('pages.taDictionary.leaf')}
                    </label>
                    <button type="button" onClick={addRoot} className="text-sm text-green-600">
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingRoot(false)}
                      className="text-sm text-red-500"
                    >
                      ✗
                    </button>
                  </div>
                  {chainSteps.length > 0 && (
                    <select
                      value={newRootStepId}
                      onChange={(e) => setNewRootStepId(e.target.value)}
                      className="h-7 w-48 rounded border border-gray-200 px-2 text-xs text-gray-700"
                    >
                      <option value="all">{t('pages.taDictionary.form.allSteps')}</option>
                      {chainSteps.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {t('pages.taDictionary.form.stepLabel', { order: s.step_order })} —{' '}
                          {s.target_action_name ?? `TA #${s.target_action_id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ---- RIGHT PANEL: Node settings ---- */}
          <div className="w-full rounded-lg border border-gray-200 bg-white p-5 lg:w-[340px]">
            {resolvedSelectedNode ? (
              <NodeSettingsPanel node={resolvedSelectedNode} chainId={selectedChainId} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                {t('pages.taDictionary.selectNodeHint')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TADictionaryPage
