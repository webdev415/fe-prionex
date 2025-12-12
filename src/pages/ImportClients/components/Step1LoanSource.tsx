/**
 * Step 1: Loan Source & Import Type
 */

import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioCard } from './RadioCard'
import { useProjects } from '@/features/projects'

export interface Step1Data {
  sellerCreditor: string
  projectCode: string
  purchaseDate: string
  comment: string
  importType: 'simple' | 'vendor'
}

interface Step1LoanSourceProps {
  data: Step1Data
  onChange: (data: Partial<Step1Data>) => void
}

export function Step1LoanSource({ data, onChange }: Step1LoanSourceProps) {
  const { data: projectsData } = useProjects({ page: 1, page_size: 100 })
  const projects = projectsData?.projects || []

  return (
    <div className="space-y-6">
      {/* Loan Source / Metadata Section */}
      <div>
        <h2 className="text-dark-500 mb-4 text-sm font-medium">Loan Source / Metadata</h2>

        <div className="space-y-4">
          {/* First Row: Seller/Creditor and Project Code side by side */}
          <div className="flex items-end gap-4">
            {/* Seller / Creditor */}
            <div className="flex-1">
              <Label htmlFor="seller-creditor" required className="mb-1.5 block">
                Seller / Creditor
              </Label>
              <Select
                value={data.sellerCreditor}
                onValueChange={(value) => onChange({ sellerCreditor: value })}
              >
                <SelectTrigger className="w-full" id="seller-creditor">
                  <SelectValue placeholder="Enter Project Name" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Code */}
            <div className="flex-1">
              <Input
                label="Project Code:"
                placeholder="Enter Project Code"
                value={data.projectCode}
                onChange={(e) => onChange({ projectCode: e.target.value })}
              />
            </div>
          </div>

          {/* Purchase Date */}
          <div>
            <DateSelect
              id="purchase-date"
              label="Purchase date:"
              value={data.purchaseDate}
              onChange={(args) => {
                const dateStr = args.value ? args.value.toISOString().split('T')[0] : ''
                onChange({ purchaseDate: dateStr })
              }}
              placeholder="Select purchase date"
            />
          </div>

          {/* Comment */}
          <div className="relative">
            <Textarea
              label="Comment:"
              placeholder="Placeholder text"
              value={data.comment}
              onChange={(e) => onChange({ comment: e.target.value })}
              maxLength={100}
              className="pb-8"
            />
            <div className="absolute right-3 bottom-3 text-xs text-gray-500">
              {data.comment.length}/100
            </div>
          </div>
        </div>
      </div>

      {/* Import Type Section */}
      <div>
        <h2 className="text-dark-500 mb-4 text-sm font-medium">Import Type:</h2>

        <div className="flex gap-4">
          <RadioCard
            name="importType"
            value="simple"
            checked={data.importType === 'simple'}
            onChange={(value) => onChange({ importType: value as 'simple' | 'vendor' })}
            title="Simple client CSV"
            description="One CSV with basic client data."
            className="flex-1"
          />

          <RadioCard
            name="importType"
            value="vendor"
            checked={data.importType === 'vendor'}
            onChange={(value) => onChange({ importType: value as 'simple' | 'vendor' })}
            title="Vendor dump (4 CSVs + documents)"
            description="Raw export from seller: users.csv, loans.csv, charges.csv, payments.csv + contracts/photos."
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
