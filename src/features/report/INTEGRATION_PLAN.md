# Report Service Frontend Integration Plan

## Overview

This document outlines the integration plan between the frontend (fe-prionex) and the Report Service backend (api-prionex/services/report).

---

## 1. Current State Analysis

### 1.1 Frontend Structure

```
src/
├── features/           # Domain-specific modules
│   ├── auth/          # Pattern to follow
│   │   ├── api/       # API calls (axios)
│   │   ├── hooks/     # React Query hooks
│   │   ├── components/
│   │   └── index.ts
│   └── clients/       # Another pattern reference
│
├── pages/
│   └── ReportsDashboard/
│       ├── components/
│       │   ├── KPICard.tsx
│       │   ├── PeriodTabs.tsx
│       │   ├── AgentPerformanceTable.tsx
│       │   └── PaymentsCollectedModal.tsx
│       ├── mockReportsData.ts  # TO BE REPLACED
│       ├── types.ts            # TO BE UPDATED
│       └── ReportsDashboardPage.tsx
```

### 1.2 Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/reports/dashboard` | GET | Dashboard with KPIs |
| `/api/v1/reports/operator-performance` | GET | Operator metrics |
| `/api/v1/reports/client-statistics` | GET | Client grouping stats |
| `/api/v1/reports/communication-statistics` | GET | Call/SMS stats |
| `/api/v1/export/dashboard` | GET | Export dashboard CSV/PDF |
| `/api/v1/export/operator-performance` | GET | Export operator report |
| `/api/v1/export/client-statistics` | GET | Export client stats |
| `/api/v1/export/communication-statistics` | GET | Export comm stats |

---

## 2. Data Structure Comparison

### 2.1 Dashboard Response

**Frontend Expects (types.ts):**
```typescript
interface DashboardResponse {
  project_id: number
  project_name: string
  date: string
  generated_at: string
  kpis: {
    total_clients: number
    calls_today: number
    calls_answered: number
    contact_rate: number        // flat number
    sms_sent_today: number
    payments_collected_today: number
    // ... more flat fields
  }
  client_stats: ClientStatistics
  top_operators: TopOperator[]
}
```

**Backend Returns:**
```python
{
  "project_id": 1,
  "period": "today",
  "generated_at": "2026-01-13T10:00:00",
  "kpis": {
    "calls_made": {
      "value": 150,
      "trend": {
        "direction": "up",
        "change": 15.5,
        "previous_value": 130
      }
    },
    "contact_rate": {
      "value": 65.5,
      "trend": {...}
    },
    "sms_sent": {
      "value": 75,
      "trend": {...}
    },
    "payments_collected": {
      "total_amount": 25000.00,
      "trend": {...}
    }
  },
  "top_operators": [
    {"operator_id": 1, "operator_name": "John", "calls_made": 50, "contact_rate": 70.0}
  ]
}
```

### 2.2 Key Differences

| Aspect | Frontend | Backend | Action |
|--------|----------|---------|--------|
| KPI structure | Flat values | Nested with trend | Transform in hook |
| Date range | `date` | `period` + computed | Add transformer |
| Trend data | Computed client-side | Included in response | Use backend trend |
| Field names | `calls_today` | `calls_made.value` | Map in transformer |
| Project name | Included | Not included | Fetch separately or add |

---

## 3. Integration Architecture

### 3.1 New Folder Structure

```
src/features/report/
├── api/
│   ├── reportApi.ts      # API calls
│   └── types.ts          # Backend response types
├── hooks/
│   ├── index.ts
│   ├── useDashboard.ts   # Dashboard query
│   ├── useOperatorPerformance.ts
│   ├── useClientStatistics.ts
│   ├── useCommunicationStatistics.ts
│   └── useExport.ts      # Export mutations
├── utils/
│   └── transformers.ts   # Data transformers
├── types/
│   └── index.ts          # Shared types
└── index.ts              # Public exports
```

### 3.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ReportsDashboardPage                         │
│                            │                                     │
│                            ▼                                     │
│                     useDashboard()                               │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                       │
│        React Query                 transformDashboard()          │
│              │                           │                       │
│              ▼                           ▼                       │
│        reportApi.getDashboard()    Backend → Frontend Format     │
│              │                                                   │
│              ▼                                                   │
│        GET /api/v1/reports/dashboard                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Steps

### Step 1: Create Backend Response Types

Create types that match exactly what the backend returns:

```typescript
// features/report/api/types.ts

export interface BackendKPIValue {
  value: number
  trend: {
    direction: 'up' | 'down' | 'stable'
    change: number
    previous_value: number
  }
}

export interface BackendPaymentKPI {
  total_amount: number
  count: number
  trend: {
    direction: 'up' | 'down' | 'stable'
    change: number
    previous_value: number
  }
}

export interface BackendDashboardResponse {
  project_id: number
  period: string
  generated_at: string
  kpis: {
    calls_made: BackendKPIValue
    contact_rate: BackendKPIValue
    sms_sent: BackendKPIValue
    payments_collected: BackendPaymentKPI
  }
  top_operators: BackendTopOperator[]
}
```

### Step 2: Create API Layer

```typescript
// features/report/api/reportApi.ts

import api from '@/lib/api'
import type { BackendDashboardResponse, ... } from './types'

const BASE_URL = '/api/v1/reports'

export async function getDashboard(params: DashboardParams) {
  const response = await api.get<BackendDashboardResponse>(
    `${BASE_URL}/dashboard`,
    { params }
  )
  return response.data
}
```

### Step 3: Create Transformers

```typescript
// features/report/utils/transformers.ts

export function transformDashboard(
  backend: BackendDashboardResponse
): DashboardResponse {
  return {
    project_id: backend.project_id,
    period: backend.period,
    generated_at: backend.generated_at,
    kpis: {
      calls_today: backend.kpis.calls_made.value,
      contact_rate: backend.kpis.contact_rate.value,
      sms_sent_today: backend.kpis.sms_sent.value,
      payments_collected_today: backend.kpis.payments_collected.total_amount,
      // Trend data for UI
      calls_trend: backend.kpis.calls_made.trend,
      contact_rate_trend: backend.kpis.contact_rate.trend,
      // ...
    },
    top_operators: backend.top_operators.map(op => ({
      operator_name: op.operator_name,
      calls_made: op.calls_made,
      contact_rate: op.contact_rate,
    })),
  }
}
```

### Step 4: Create React Query Hooks

```typescript
// features/report/hooks/useDashboard.ts

import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../api/reportApi'
import { transformDashboard } from '../utils/transformers'

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: (params: DashboardParams) =>
    [...reportKeys.all, 'dashboard', params] as const,
  // ...
}

export function useDashboard(params: DashboardParams) {
  return useQuery({
    queryKey: reportKeys.dashboard(params),
    queryFn: async () => {
      const data = await reportApi.getDashboard(params)
      return transformDashboard(data)
    },
    staleTime: 60000, // 1 minute (reports cached by Redis)
    refetchInterval: 300000, // Refetch every 5 minutes
  })
}
```

### Step 5: Update Page Component

```typescript
// pages/ReportsDashboard/ReportsDashboardPage.tsx

import { useDashboard, useOperatorPerformance } from '@/features/report'

export function ReportsDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today')

  // Replace mock data with real API calls
  const { data: dashboardData, isLoading, error } = useDashboard({
    project_id: activeProject.id,
    period: selectedPeriod,
  })

  const { data: operatorData } = useOperatorPerformance({
    project_id: activeProject.id,
    period: selectedPeriod,
  })

  if (isLoading) return <ReportsDashboardPageSkeleton />
  if (error) return <ErrorState error={error} />

  // Use real data instead of mock
  return (
    <div>
      <KPICard
        title={t('pages.reports.kpi.callsMade')}
        value={dashboardData.kpis.calls_today.toString()}
        change={dashboardData.kpis.calls_trend.change}
        changeType={dashboardData.kpis.calls_trend.direction === 'up' ? 'increase' : 'decrease'}
        // ...
      />
    </div>
  )
}
```

---

## 5. Export Functionality

### 5.1 Backend Export Endpoints

```
GET /api/v1/export/dashboard?project_id=1&format=csv&period=today
GET /api/v1/export/dashboard?project_id=1&format=pdf&period=today
```

### 5.2 Frontend Implementation

```typescript
// features/report/hooks/useExport.ts

export function useExportDashboard() {
  return useMutation({
    mutationFn: async (params: ExportParams) => {
      const response = await api.get(`/api/v1/export/dashboard`, {
        params,
        responseType: 'blob',
      })

      // Trigger download
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dashboard_${params.period}.${params.format}`
      link.click()
    },
  })
}
```

---

## 6. Period Mapping

| Frontend Period | Backend Period | Date Range |
|-----------------|----------------|------------|
| `'today'` | `'today'` | Current day |
| `'thisWeek'` | `'this_week'` | Current week |
| `'thisMonth'` | `'this_month'` | Current month |

```typescript
// utils/transformers.ts

export function mapPeriod(frontendPeriod: Period): string {
  const periodMap: Record<Period, string> = {
    'today': 'today',
    'thisWeek': 'this_week',
    'thisMonth': 'this_month',
  }
  return periodMap[frontendPeriod]
}
```

---

## 7. Error Handling

```typescript
// features/report/hooks/useDashboard.ts

export function useDashboard(params: DashboardParams) {
  return useQuery({
    queryKey: reportKeys.dashboard(params),
    queryFn: () => reportApi.getDashboard(params),
    retry: 2,
    onError: (error: AxiosError) => {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view reports')
      } else if (error.response?.status === 404) {
        toast.error('No report data found for this period')
      } else {
        toast.error('Failed to load dashboard data')
      }
    },
  })
}
```

---

## 8. Files to Create

| File | Description |
|------|-------------|
| `features/report/api/types.ts` | Backend response types |
| `features/report/api/reportApi.ts` | API calls |
| `features/report/hooks/index.ts` | Hook exports |
| `features/report/hooks/useDashboard.ts` | Dashboard query hook |
| `features/report/hooks/useOperatorPerformance.ts` | Operator report hook |
| `features/report/hooks/useClientStatistics.ts` | Client stats hook |
| `features/report/hooks/useCommunicationStatistics.ts` | Comm stats hook |
| `features/report/hooks/useExport.ts` | Export mutations |
| `features/report/utils/transformers.ts` | Data transformers |
| `features/report/types/index.ts` | Shared frontend types |
| `features/report/index.ts` | Public exports |

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `pages/ReportsDashboard/ReportsDashboardPage.tsx` | Replace mock with hooks |
| `pages/ReportsDashboard/types.ts` | Keep for UI types, import from feature |
| `pages/ReportsDashboard/mockReportsData.ts` | Delete after integration |

---

## 10. Testing Checklist

- [ ] Dashboard loads with real data
- [ ] Period switching works (today/week/month)
- [ ] KPI cards show correct values
- [ ] Trend arrows show correct direction
- [ ] Top operators table populates
- [ ] CSV export downloads correctly
- [ ] PDF export downloads correctly
- [ ] Error states display properly
- [ ] Loading skeleton shows during fetch
- [ ] Data refreshes at correct intervals
