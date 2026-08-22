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
  useScorecardStatusByCalls,
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
// Call QA (Ф1) — AI transcripts
export { getCallTranscript, transcriptKeys } from './api/transcriptService'
export { useCallTranscript } from './hooks/useCallTranscript'
// Call QA — global «AI call analysis» switch
export {
  getCallQaSettings,
  updateCallQaSettings,
  callQaSettingsKey,
} from './api/callQaSettingsService'
export type { CallQaSettings } from './api/callQaSettingsService'
export { useCallQaSettings, useUpdateCallQaSettings } from './hooks/useCallQaSettings'
// Call QA listening rules — blocker dictionary + AI rubrics (manage_qa_rules)
export {
  listQaBlockers,
  createQaBlocker,
  updateQaBlocker,
  deleteQaBlocker,
  listQaTemplates,
  createQaTemplate,
  updateQaTemplate,
  archiveQaTemplate,
  unarchiveQaTemplate,
} from './api/qaRulesService'
export {
  qaRulesKeys,
  useQaBlockers,
  useCreateQaBlocker,
  useUpdateQaBlocker,
  useDeleteQaBlocker,
  useQaRubrics,
  useCreateQaRubric,
  useUpdateQaRubric,
  useArchiveQaRubric,
  useUnarchiveQaRubric,
} from './hooks/useQaRules'

export { ScorecardPanel } from './components/ScorecardPanel'
export { ScoreDivergenceBadge } from './components/ScoreDivergenceBadge'
export { MarkerOverlay } from './components/MarkerOverlay'
export { AddMarkerButton } from './components/AddMarkerButton'
export { LeaveFeedbackButton } from './components/LeaveFeedbackButton'
export { FeedbackThreadView } from './components/FeedbackThreadView'
export { ScoreDynamicsChart } from './components/ScoreDynamicsChart'
export { CallTranscriptPanel } from './components/CallTranscriptPanel'
export { CallQaSettingsSection } from './components/CallQaSettingsSection'
export { QaListeningSection } from './components/qaRules/QaListeningSection'
export { QaBlockersTable } from './components/qaRules/QaBlockersTable'
export { AiRubricsSection } from './components/qaRules/AiRubricsSection'
export { AiRubricEditor } from './components/qaRules/AiRubricEditor'

export type {
  AggregateFilters,
  AggregateGroupBy,
  AggregateResponse,
  AggregateRow,
  CallScorecardStatus,
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
  CallTranscript,
  CallTranscriptDto,
  CallAiReview,
  TranscriptUtterance,
  TranscriptUtteranceFlag,
  TranscriptScene,
  TranscriptQueryResult,
  ReviewRedFlag,
  ReviewPromise,
  BlockerCategory,
  BlockerLang,
  BlockerSeverity,
  QaBlocker,
  QaBlockerCreatePayload,
  QaBlockerListFilters,
  QaBlockerUpdatePayload,
  TemplateCreatePayload,
  TemplateListFilters,
  TemplatePurpose,
  TemplateUpdatePayload,
} from './types'

export { MARKER_TYPES, MARKER_COLORS, FEEDBACK_TYPES } from './types'
export {
  BLOCKER_CATEGORIES,
  BLOCKER_LANGS,
  BLOCKER_SEVERITIES,
  CRITERION_SCALES,
  normalizeCriterionScale,
} from './types'
export {
  RUBRIC_TOTAL_WEIGHT,
  RUBRIC_WEIGHT_TOLERANCE,
  isRubricWeightValid,
  makeUniqueKey,
  sumCriteriaWeights,
} from './lib/rubricWeights'

export { computeWeightedScorePreview } from './lib/scoringPreview'

export {
  DEFAULT_DISPUTE_THRESHOLD,
  isDisputeReasonRequested,
  resolveDisputeThreshold,
  scoreDivergence,
  trainerScoreTo100,
} from './lib/dispute'
