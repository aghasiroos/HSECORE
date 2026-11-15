import { useState } from 'react';
import moment from 'moment-jalaali';
import {
  AnyRiskAssessment,
  RiskAssessmentStatus,
  RiskWorkflowStage,
} from '../../types';
import {
  ValidationIssue,
  validateAssessmentWorkflow,
} from '../../services/riskWorkflowEngine';

export function useRiskFormWorkflow<T extends AnyRiskAssessment>(
  formData: T,
  setFormData: React.Dispatch<React.SetStateAction<T>>,
  onSave: (assessment: T) => Promise<void> | void,
  currentUser: any,
  isFa: boolean
) {
  const [saving, setSaving] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userRole = String(currentUser?.role || '').toUpperCase().replace(/[\s-]+/g, '_');
  const canApprove =
    ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER', 'EXECUTIVEMANAGER'].includes(userRole) ||
    !currentUser?.role;

  const actorName = currentUser?.name || currentUser?.username || (isFa ? 'کارشناس HSE' : 'HSE User');

  const appendReviewNote = (
    current: T,
    toStatus: RiskAssessmentStatus,
    toStage: RiskWorkflowStage,
    notes: string
  ): T => {
    const history = Array.isArray(current.reviewHistory) ? [...current.reviewHistory] : [];
    history.unshift({
      id: `rev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      persianDate: moment().format('jYYYY/jMM/jDD HH:mm'),
      actor: actorName,
      actorRole: currentUser?.role || '',
      fromStatus: current.status,
      toStatus,
      fromStage: current.workflowStage,
      toStage,
      notes,
    });
    return {
      ...current,
      status: toStatus,
      workflowStage: toStage,
      reviewHistory: history,
      updatedAt: new Date().toISOString(),
    };
  };

  const executeTransition = async (
    mode: 'DRAFT' | 'SUBMIT_REVIEW' | 'APPROVE' | 'ARCHIVE',
    nextStatus: RiskAssessmentStatus,
    nextStage: RiskWorkflowStage,
    noteText: string
  ) => {
    const issues = validateAssessmentWorkflow(formData, mode);
    if (issues.length > 0) {
      setValidationIssues(issues);
      setFeedbackBanner({
        text: isFa
          ? `${issues.length} مورد نقص در اطلاعات فرم وجود دارد.`
          : `${issues.length} validation issues found.`,
        type: 'error',
      });
      return;
    }

    setValidationIssues([]);
    setSaving(true);
    try {
      const enriched = appendReviewNote(formData, nextStatus, nextStage, noteText);
      if (mode === 'APPROVE' && !enriched.approverName) {
        enriched.approverName = actorName;
      }
      setFormData(enriched);
      await onSave(enriched);
      setFeedbackBanner({
        text: isFa ? 'اطلاعات با موفقیت در پایگاه داده ذخیره شد.' : 'Saved successfully.',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackBanner({
        text: err?.message || (isFa ? 'خطا در ذخیره ارزیابی ریسک' : 'Failed to save assessment'),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    validationIssues,
    feedbackBanner,
    setFeedbackBanner,
    canApprove,
    actorName,
    saveDraft: () =>
      executeTransition(
        'DRAFT',
        'DRAFT',
        formData.workflowStage || 'INITIAL_INFO',
        isFa ? 'ذخیره پیش‌نویس ارزیابی' : 'Saved draft'
      ),
    submitForReview: () =>
      executeTransition(
        'SUBMIT_REVIEW',
        'UNDER_REVIEW',
        'REVIEW_APPROVAL',
        isFa ? 'ارسال جهت بازبینی و تایید HSE' : 'Submitted for HSE review'
      ),
    approveAssessment: () =>
      executeTransition(
        'APPROVE',
        'APPROVED',
        formData.controlActions && formData.controlActions.length > 0 ? 'ACTION_EXECUTION' : 'RESIDUAL_REEVALUATION',
        isFa ? 'تایید نهایی کارشناس / مدیر HSE' : 'Approved by HSE'
      ),
    archiveAssessment: () =>
      executeTransition(
        'ARCHIVE',
        'ARCHIVED',
        'EFFECTIVENESS_ARCHIVE',
        isFa ? 'تایید اثربخشی و بایگانی پرونده' : 'Verified and archived'
      ),
  };
}
