export {
  qualityService,
  listTemplates,
  getTemplate,
  listScorecards,
  listMyScorecards,
  getScorecard,
  getScorecardHistoryForCall,
  getScorecardAggregate,
  getStageFunnel,
  createScorecard,
  updateScorecard,
  sendScorecard,
  deleteScorecard,
  exportScorecards,
  listMarkersForCall,
  createMarker,
  updateMarker,
  deleteMarker,
  addMarkerToLibrary,
  listMarkers,
  exportMarkers,
  listFeedback,
  getFeedback,
  createFeedback,
  replyToFeedback,
  markFeedbackRead,
  exportFeedback,
  getOperatorDynamics,
  exportOperatorDynamics,
  listDynamicsAlerts,
} from './api/qualityService'

export { useTemplates, templateKeys } from './hooks/useTemplates'
export {
  useScorecards,
  useMyScorecards,
  useScorecard,
  useScorecardHistoryForCall,
  useScorecardAggregate,
  useCreateScorecard,
  useUpdateScorecard,
  useSendScorecard,
  useDeleteScorecard,
  useExportScorecards,
  scorecardKeys,
} from './hooks/useScorecards'
export { useScorecardDraft } from './hooks/useScorecardDraft'
export {
  useMarkers,
  useMarkersForCall,
  useCreateMarker,
  useUpdateMarker,
  useDeleteMarker,
  useAddMarkerToLibrary,
  useExportMarkers,
  markerKeys,
} from './hooks/useMarkers'
export {
  useFeedback,
  useFeedbackDetail,
  useCreateFeedback,
  useReplyToFeedback,
  useMarkFeedbackRead,
  useExportFeedback,
  feedbackKeys,
} from './hooks/useFeedback'
export {
  useOperatorDynamics,
  useDynamicsAlerts,
  useExportOperatorDynamics,
  dynamicsKeys,
} from './hooks/useDynamics'
export { useStageFunnel, stageFunnelKeys } from './hooks/useStageFunnel'

export { ScorecardPanel } from './components/ScorecardPanel'
export { MarkerOverlay } from './components/MarkerOverlay'
export { AddMarkerButton } from './components/AddMarkerButton'
export { LeaveFeedbackButton } from './components/LeaveFeedbackButton'
export { FeedbackThreadView } from './components/FeedbackThreadView'
export { ScoreDynamicsChart } from './components/ScoreDynamicsChart'

export type {
  AggregateFilters,
  AggregateGroupBy,
  AggregateResponse,
  AggregateRow,
  Criterion,
  CriterionScale,
  PageResponse,
  Pagination,
  Scorecard,
  ScorecardCreatePayload,
  ScorecardHistoryItem,
  ScorecardListFilters,
  ScorecardStatus,
  ScorecardTemplate,
  ScorecardType,
  ScorecardUpdatePayload,
  ScoreEntry,
  ScoresPayload,
  Section,
  CallMarker,
  MarkerCreatePayload,
  MarkerListFilters,
  MarkerStatus,
  MarkerType,
  MarkerUpdatePayload,
  Feedback,
  FeedbackCreatePayload,
  FeedbackListFilters,
  FeedbackReply,
  FeedbackStatus,
  FeedbackType,
  DynamicsGranularity,
  DynamicsPoint,
  SectionBreakdownPoint,
  TeamBenchmarkPoint,
  DynamicsResponse,
  DynamicsFilters,
  DynamicsAlertType,
  ScoreDynamicsAlert,
  AlertsResponse,
  FunnelBand,
  FunnelDateType,
  StageDto,
  PainPointDto,
  PainPoints,
  StageFunnelResponse,
  StageFunnelFilters,
} from './types'

export { MARKER_TYPES, MARKER_COLORS, FEEDBACK_TYPES } from './types'

export { computeWeightedScorePreview } from './lib/scoringPreview'
