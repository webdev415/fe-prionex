/**
 * Right-side panel — "Node settings" from the mockup.
 * Shows editable fields for the currently selected node.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  useUpdateDictionaryNode,
  useHideDictionaryNode,
  useUnhideDictionaryNode,
  useCreateDictionaryNode,
} from '@/features/taDictionary/hooks/useTADictionary'
import type { TADictionaryNode } from '@/features/taDictionary/api/types'
import { getErrorMessage } from '@/lib/errors'

interface Props {
  node: TADictionaryNode
  chainId: number
}

export function NodeSettingsPanel({ node, chainId }: Props) {
  const { t } = useTranslation('common')
  const updateMut = useUpdateDictionaryNode()
  const hideMut = useHideDictionaryNode()
  const unhideMut = useUnhideDictionaryNode()
  const createMut = useCreateDictionaryNode()

  const [name, setName] = useState(node.name)
  const [nodeType, setNodeType] = useState<'leaf' | 'intermediate'>(
    node.is_leaf ? 'leaf' : 'intermediate'
  )
  const [promiseDate, setPromiseDate] = useState(node.require_promise_date)
  const [promiseAmount, setPromiseAmount] = useState(node.require_promise_amount)
  const [requireCredit, setRequireCredit] = useState(node.require_credit)
  const [isPositive, setIsPositive] = useState(node.is_positive)

  // Adding child inline
  const [addingChild, setAddingChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [childIsLeaf, setChildIsLeaf] = useState(false)

  // Sync local state when the selected node changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setName(node.name)
    setNodeType(node.is_leaf ? 'leaf' : 'intermediate')
    setPromiseDate(node.require_promise_date)
    setPromiseAmount(node.require_promise_amount)
    setRequireCredit(node.require_credit)
    setIsPositive(node.is_positive)
    setAddingChild(false)
  }, [
    node.id,
    node.name,
    node.is_leaf,
    node.require_promise_date,
    node.require_promise_amount,
    node.is_positive,
    node.require_credit,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = async () => {
    try {
      await updateMut.mutateAsync({
        id: node.id,
        payload: {
          name: name.trim() || undefined,
          is_leaf: nodeType === 'leaf',
          require_promise_date: promiseDate,
          require_promise_amount: promiseAmount,
          require_credit: requireCredit,
          is_positive: isPositive,
        },
      })
      toast.success(t('pages.taDictionary.toasts.saved'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const toggleHidden = async () => {
    try {
      if (node.is_hidden) {
        await unhideMut.mutateAsync(node.id)
        toast.success(t('pages.taDictionary.toasts.unhidden'))
      } else {
        await hideMut.mutateAsync(node.id)
        toast.success(t('pages.taDictionary.toasts.hidden'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const addChild = async () => {
    if (!childName.trim()) return
    try {
      await createMut.mutateAsync({
        chainId,
        payload: {
          chain_id: chainId,
          parent_id: node.id,
          name: childName.trim(),
          is_leaf: childIsLeaf,
        },
      })
      setChildName('')
      setChildIsLeaf(false)
      setAddingChild(false)
      toast.success(t('pages.taDictionary.toasts.childAdded'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-dark-500 text-lg font-semibold">
        {t('pages.taDictionary.nodeSettings')}
      </h2>
      <p className="text-xs text-gray-500">
        {t('pages.taDictionary.selectedLabel')}: {node.name}
      </p>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <Label>{t('pages.taDictionary.form.name')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Node type */}
      <div className="flex flex-col gap-1">
        <Label>{t('pages.taDictionary.form.nodeType')}</Label>
        <Select value={nodeType} onValueChange={(v) => setNodeType(v as 'leaf' | 'intermediate')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leaf">{t('pages.taDictionary.form.leafSelectable')}</SelectItem>
            <SelectItem value="intermediate">
              {t('pages.taDictionary.form.intermediateCategory')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leaf config */}
      {nodeType === 'leaf' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">
            {t('pages.taDictionary.form.leafConfig')}
          </span>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={promiseDate}
              onChange={(e) => setPromiseDate(e.target.checked)}
            />
            {t('pages.taDictionary.requirePromiseDate')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={promiseAmount}
              onChange={(e) => setPromiseAmount(e.target.checked)}
            />
            {t('pages.taDictionary.requirePromiseAmount')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={requireCredit}
              onChange={(e) => setRequireCredit(e.target.checked)}
            />
            {t('pages.taDictionary.requireCredit')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPositive}
              onChange={(e) => setIsPositive(e.target.checked)}
            />
            {t('pages.taDictionary.isPositive')}
          </label>
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            node.is_hidden ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'
          }`}
        >
          {node.is_hidden ? t('pages.taDictionary.inactive') : t('pages.taDictionary.active')}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={save}>
          {t('actions.save')}
        </Button>
        <Button variant="cancel" size="sm" onClick={toggleHidden}>
          {node.is_hidden ? t('pages.taDictionary.unhide') : t('pages.taDictionary.hide')}
        </Button>
        {!node.is_leaf && !node.is_hidden && (
          <Button variant="cancel" size="sm" onClick={() => setAddingChild(!addingChild)}>
            {t('pages.taDictionary.addChild')}
          </Button>
        )}
      </div>

      {/* Add child form */}
      {addingChild && (
        <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <Label>{t('pages.taDictionary.addChild')}</Label>
          <Input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder={t('pages.taDictionary.newNodeName')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addChild()
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={childIsLeaf}
              onChange={(e) => setChildIsLeaf(e.target.checked)}
            />
            {t('pages.taDictionary.form.leafSelectable')}
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={addChild}>
              {t('actions.save')}
            </Button>
            <Button variant="cancel" size="sm" onClick={() => setAddingChild(false)}>
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
