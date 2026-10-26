import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule
} from 'bpmn-js-properties-panel';
import camundaModdleDescriptor from 'camunda-bpmn-moddle/resources/camunda.json';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  SlidersHorizontal,
  Info,
  Layers,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';

// Stylesheets
import '@bpmn-io/properties-panel/assets/properties-panel.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './bpmn-designer.css';

// Subcomponents
import BpmnToolbar from './components/BpmnToolbar';
import BpmnValidationModal, { BpmnValidationIssue } from './components/BpmnValidationModal';
import BpmnLiveTrackingBar from './components/BpmnLiveTrackingBar';
import StepApproverModal from './components/StepApproverModal';
import WorkflowApproversMatrixDrawer from './components/WorkflowApproversMatrixDrawer';
import BpmnPropertiesPanel from './components/BpmnPropertiesPanel';
import { WorkflowInstance, WorkflowItem, WorkflowStep } from './types';
import { extractStepsFromBpmnModeler } from './utils/approverHelper';
import { Users, Sliders } from 'lucide-react';

interface Props {
  language: 'fa' | 'en';
  workflowId?: string | null;
  onSaved?: () => void;
}

const standardInitialDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="5.0.0">
  <bpmn:process id="Process_HSE_01" name="فرآیند جدید HSE" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="شروع فرآیند">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Activity_1" name="بررسی و اقدام ایمنی">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Activity_1" />
    <bpmn:endEvent id="EndEvent_1" name="پایان فرآیند">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Activity_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_HSE_01">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="182" y="162" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="171" y="205" width="58" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_1_di" bpmnElement="Activity_1">
        <dc:Bounds x="280" y="140" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="472" y="162" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="466" y="205" width="48" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="218" y="180" />
        <di:waypoint x="280" y="180" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="400" y="180" />
        <di:waypoint x="472" y="180" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default function ProcessDesigner({ language, workflowId, onSaved }: Props) {
  const isFa = language === 'fa';
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modeler, setModeler] = useState<BpmnModeler | null>(null);
  const [processName, setProcessName] = useState('فرآیند جدید HSE');
  const [moduleType, setModuleType] = useState('ptw-management');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowItem[]>([]);

  // Modeler state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Validation
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<BpmnValidationIssue[]>([]);

  // Live Tracking
  const [liveTrackingActive, setLiveTrackingActive] = useState(false);
  const [liveInstances, setLiveInstances] = useState<WorkflowInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);

  // Step Approvers State
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [selectedElement, setSelectedElement] = useState<any | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedStepForModal, setSelectedStepForModal] = useState<WorkflowStep | null>(null);
  const [approverMatrixOpen, setApproverMatrixOpen] = useState(false);

  const selectedTaskStep = useMemo(() => {
    if (!selectedTaskId) return null;
    return steps.find(s => s.id === selectedTaskId) || null;
  }, [steps, selectedTaskId]);

  const handleUpdateStep = useCallback((updatedStep: WorkflowStep) => {
    setSteps(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
  }, []);

  const handleUpdateElementLabel = useCallback((elementId: string, newLabel: string) => {
    if (!modeler) return;
    try {
      const elementRegistry = modeler.get('elementRegistry') as any;
      const modeling = modeler.get('modeling') as any;
      const el = elementRegistry.get(elementId);
      if (el) {
        modeling.updateLabel(el, newLabel);
      }
      setSteps(prev => prev.map(s => s.id === elementId ? { ...s, titleFa: newLabel, titleEn: newLabel } : s));
    } catch (e) {
      console.error('Failed to update element label', e);
    }
  }, [modeler]);

  // Load available workflows for catalog templates
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/process-management/workflows');
      if (res.data.success && Array.isArray(res.data.data)) {
        setAvailableWorkflows(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Modeler Initialization
  useEffect(() => {
    if (!containerRef.current || !propertiesRef.current) return;

    let isSubscribed = true;
    let isDestroyed = false;

    // Reset container DOM before instantiating
    if (containerRef.current) containerRef.current.innerHTML = '';
    if (propertiesRef.current) propertiesRef.current.innerHTML = '';

    const bpmnModeler = new BpmnModeler({
      container: containerRef.current,
      propertiesPanel: {
        parent: propertiesRef.current
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule
      ],
      moddleExtensions: {
        camunda: camundaModdleDescriptor
      }
    });

    // Event listeners on modeler
    bpmnModeler.on('commandStack.changed', () => {
      if (!isSubscribed || isDestroyed) return;
      try {
        const commandStack = bpmnModeler.get('commandStack') as any;
        setCanUndo(Boolean(commandStack.canUndo()));
        setCanRedo(Boolean(commandStack.canRedo()));
        setSteps(prev => extractStepsFromBpmnModeler(bpmnModeler, prev));
      } catch (e) {
        // ignore
      }
    });

    bpmnModeler.on('selection.changed', (e: any) => {
      if (!isSubscribed || isDestroyed) return;
      try {
        const selection = e.newSelection || [];
        if (selection.length === 1) {
          setSelectedElement(selection[0]);
          if (selection[0].type && (selection[0].type.includes('Task') || selection[0].type === 'bpmn:UserTask')) {
            setSelectedTaskId(selection[0].id);
          } else {
            setSelectedTaskId(null);
          }
        } else {
          setSelectedElement(null);
          setSelectedTaskId(null);
        }
      } catch (e) {
        // ignore
      }
    });

    const loadInitialDiagram = async () => {
      let diagramXml = standardInitialDiagram;
      let initialSteps: WorkflowStep[] = [];

      if (workflowId) {
        try {
          const res = await axios.get(`/api/v1/process-management/workflows/${workflowId}`);
          if (!isSubscribed || isDestroyed) return;
          if (res.data.success && res.data.data) {
            const data = res.data.data;
            setProcessName(data.name || 'فرآیند HSE');
            setModuleType(data.module_type || 'ptw-management');
            diagramXml = data.xml_data || standardInitialDiagram;
            if (data.steps && Array.isArray(data.steps)) {
              initialSteps = data.steps;
              setSteps(data.steps);
            }
          }
        } catch (e) {
          if (!isSubscribed || isDestroyed) return;
          console.error(e);
          toast.error(isFa ? 'خطا در بارگذاری فرآیند' : 'Error loading process');
        }
      }

      if (!isSubscribed || isDestroyed) return;

      try {
        await bpmnModeler.importXML(diagramXml);
        if (!isSubscribed || isDestroyed) return;
        const canvas = bpmnModeler.get('canvas') as any;
        canvas.zoom('fit-viewport');
        setModeler(bpmnModeler);
        setSteps(prev => extractStepsFromBpmnModeler(bpmnModeler, initialSteps.length ? initialSteps : prev));
      } catch (err: any) {
        if (!isSubscribed || isDestroyed) return;
        console.error('Failed to import BPMN diagram', err);
      }
    };

    loadInitialDiagram();

    return () => {
      isSubscribed = false;
      isDestroyed = true;
      setModeler(null);
      try {
        bpmnModeler.destroy();
      } catch (e) {
        // ignore errors during unmount destruction
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (propertiesRef.current) {
        propertiesRef.current.innerHTML = '';
      }
    };
  }, [workflowId]);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+0, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCustom();
      }
      // Check for Ctrl/Cmd + 0 for Fit View
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleZoomFit();
      }
      // Check for Ctrl/Cmd + E for export
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportXml();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modeler, processName, moduleType, workflowId]);

  // Modeler Actions
  const handleUndo = () => {
    if (!modeler) return;
    try {
      const commandStack = modeler.get('commandStack') as any;
      commandStack.undo();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRedo = () => {
    if (!modeler) return;
    try {
      const commandStack = modeler.get('commandStack') as any;
      commandStack.redo();
    } catch (e) {
      console.error(e);
    }
  };

  const handleZoomIn = () => {
    if (!modeler) return;
    const canvas = modeler.get('canvas') as any;
    canvas.zoom(canvas.zoom() * 1.2);
  };

  const handleZoomOut = () => {
    if (!modeler) return;
    const canvas = modeler.get('canvas') as any;
    canvas.zoom(canvas.zoom() * 0.8);
  };

  const handleZoomFit = () => {
    if (!modeler) return;
    const canvas = modeler.get('canvas') as any;
    canvas.zoom('fit-viewport');
  };

  const handleZoomReset = () => {
    if (!modeler) return;
    const canvas = modeler.get('canvas') as any;
    canvas.zoom(1.0);
  };

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Synchronize fullscreen state side-effects (resizing, DOM events, native browser fullscreen)
  useEffect(() => {
    if (!isFullscreen) return;

    window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: true } }));

    try {
      if (containerRef.current?.parentElement?.requestFullscreen) {
        containerRef.current.parentElement.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    const timer = setTimeout(() => {
      if (modeler) {
        try {
          const canvas = modeler.get('canvas') as any;
          canvas.resized();
          canvas.zoom('fit-viewport');
        } catch (e) {}
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: false } }));
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}

      setTimeout(() => {
        if (modeler) {
          try {
            const canvas = modeler.get('canvas') as any;
            canvas.resized();
            canvas.zoom('fit-viewport');
          } catch (e) {}
        }
      }, 150);
    };
  }, [isFullscreen, modeler]);

  // Keyboard listener for Escape & sync with native fullscreen changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isFullscreen]);

  const handleDeleteSelected = () => {
    if (!modeler) return;
    try {
      const selection = modeler.get('selection') as any;
      const modeling = modeler.get('modeling') as any;
      const selectedElements = selection.get();
      if (selectedElements.length > 0) {
        modeling.removeElements(selectedElements);
      } else {
        toast(isFa ? 'ابتدا عنصری را در بوم انتخاب کنید' : 'Select an element first');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewDiagram = async () => {
    if (!modeler) return;
    try {
      await modeler.importXML(standardInitialDiagram);
      const canvas = modeler.get('canvas') as any;
      canvas.zoom('fit-viewport');
      setProcessName('فرآیند جدید HSE');
      toast.success(isFa ? 'فرآیند جدید ایجاد شد.' : 'New process diagram created.');
    } catch (err) {
      console.error(err);
      toast.error(isFa ? 'خطا در ایجاد فرآیند' : 'Error creating new diagram');
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    if (!templateId || !modeler) return;
    try {
      const res = await axios.get(`/api/v1/process-management/workflows/${templateId}`);
      if (res.data.success && res.data.data) {
        const wf = res.data.data;
        setProcessName(wf.name);
        setModuleType(wf.module_type || 'ptw-management');
        if (wf.xml_data) {
          await modeler.importXML(wf.xml_data);
          const canvas = modeler.get('canvas') as any;
          canvas.zoom('fit-viewport');
          toast.success(isFa ? `قالب «${wf.name}» بارگذاری شد.` : 'Template loaded.');
        }
      }
    } catch (e) {
      toast.error(isFa ? 'خطا در بارگذاری قالب' : 'Error loading template');
    }
  };

  // BPMN Structural Validation
  const runValidation = (): BpmnValidationIssue[] => {
    if (!modeler) return [];
    const issues: BpmnValidationIssue[] = [];

    try {
      const elementRegistry = modeler.get('elementRegistry') as any;
      const allElements = elementRegistry.getAll();

      const startEvents = allElements.filter((e: any) => e.type === 'bpmn:StartEvent');
      const endEvents = allElements.filter((e: any) => e.type === 'bpmn:EndEvent');
      const tasks = allElements.filter((e: any) => e.type.includes('Task'));
      const gateways = allElements.filter((e: any) => e.type.includes('Gateway'));
      const sequenceFlows = allElements.filter((e: any) => e.type === 'bpmn:SequenceFlow');

      // Check Start Event
      if (startEvents.length === 0) {
        issues.push({
          id: 'missing-start-event',
          type: 'error',
          messageFa: 'فرآیند فاقد رویداد شروع (Start Event) است.',
          messageEn: 'Process must have at least one Start Event.'
        });
      }

      // Check End Event
      if (endEvents.length === 0) {
        issues.push({
          id: 'missing-end-event',
          type: 'error',
          messageFa: 'فرآیند فاقد رویداد پایان (End Event) است.',
          messageEn: 'Process must have at least one End Event.'
        });
      }

      // Check Tasks with no labels
      tasks.forEach((task: any) => {
        const name = task.businessObject?.name?.trim();
        if (!name) {
          issues.push({
            id: `empty-name-${task.id}`,
            elementId: task.id,
            type: 'warning',
            messageFa: 'این فعالیت فاقد عنوان یا نام مشخص است.',
            messageEn: 'This task does not have a descriptive name.',
            elementName: task.id
          });
        }

        // Check if task is disconnected
        const hasIncoming = task.incoming && task.incoming.length > 0;
        const hasOutgoing = task.outgoing && task.outgoing.length > 0;
        if (!hasIncoming || !hasOutgoing) {
          issues.push({
            id: `disconnected-${task.id}`,
            elementId: task.id,
            type: 'warning',
            messageFa: 'اتصال جریان متوالی (Sequence Flow) برای این فعالیت ناقص است.',
            messageEn: 'Task is missing incoming or outgoing sequence flow.',
            elementName: name || task.id
          });
        }
      });

      // Check Gateways with only 1 outgoing flow
      gateways.forEach((gw: any) => {
        if (!gw.outgoing || gw.outgoing.length < 2) {
          issues.push({
            id: `gw-branch-${gw.id}`,
            elementId: gw.id,
            type: 'info',
            messageFa: 'گیت تصمیم‌گیری کمتر از دو مسیر خروجی دارد.',
            messageEn: 'Decision gateway has fewer than two outgoing branches.',
            elementName: gw.businessObject?.name || gw.id
          });
        }
      });

      // Check SequenceFlow validity
      sequenceFlows.forEach((flow: any) => {
        if (!flow.source || !flow.target) {
          issues.push({
            id: `flow-dangling-${flow.id}`,
            elementId: flow.id,
            type: 'error',
            messageFa: 'یک جریان توالی بدون مبدا یا مقصد مشخص یافت شد.',
            messageEn: 'Sequence flow is missing source or target element.',
            elementName: flow.id
          });
        }
      });

    } catch (err) {
      console.error('Validation scan error', err);
    }

    setValidationIssues(issues);
    return issues;
  };

  const handleValidateClick = () => {
    const issues = runValidation();
    setValidationModalOpen(true);
    if (issues.length === 0) {
      toast.success(isFa ? 'فرآیند بدون نقص است.' : 'No validation issues detected.');
    }
  };

  const handleSelectElementFromValidation = (elementId: string) => {
    if (!modeler) return;
    try {
      const elementRegistry = modeler.get('elementRegistry') as any;
      const element = elementRegistry.get(elementId);
      if (element) {
        const selection = modeler.get('selection') as any;
        const canvas = modeler.get('canvas') as any;
        selection.set([element]);
        canvas.scrollToElement(element);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Live Tracking Logic
  const fetchLiveInstances = async () => {
    try {
      const res = await axios.get('/api/v1/process-management/instances');
      if (res.data.success && Array.isArray(res.data.data)) {
        setLiveInstances(res.data.data);
        if (res.data.data.length > 0 && !selectedInstance) {
          setSelectedInstance(res.data.data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearLiveTrackingOverlays = () => {
    if (!modeler) return;
    try {
      const overlays = modeler.get('overlays') as any;
      const canvas = modeler.get('canvas') as any;
      const elementRegistry = modeler.get('elementRegistry') as any;

      overlays.clear();
      elementRegistry.getAll().forEach((elem: any) => {
        canvas.removeMarker(elem.id, 'bpmn-node-active');
        canvas.removeMarker(elem.id, 'bpmn-node-completed');
        canvas.removeMarker(elem.id, 'bpmn-node-rejected');
      });
    } catch (e) {
      console.error(e);
    }
  };

  const applyLiveTrackingOverlays = (inst: WorkflowInstance | null) => {
    if (!modeler || !inst) return;
    clearLiveTrackingOverlays();

    try {
      const overlays = modeler.get('overlays') as any;
      const canvas = modeler.get('canvas') as any;
      const elementRegistry = modeler.get('elementRegistry') as any;

      const allElements = elementRegistry.getAll();
      const taskNodes = allElements.filter((e: any) => e.type.includes('Task') || e.type === 'bpmn:StartEvent');

      taskNodes.forEach((node: any, idx: number) => {
        const isCompleted = idx < inst.currentStepIndex || inst.state === 'COMPLETED';
        const isActive = idx === inst.currentStepIndex && inst.state === 'ACTIVE';
        const isRejected = idx === inst.currentStepIndex && inst.state === 'REJECTED';

        if (isActive) {
          canvas.addMarker(node.id, 'bpmn-node-active');
          overlays.add(node.id, {
            position: { top: -14, right: 0 },
            html: `<div class="bpmn-overlay-badge bpmn-overlay-active">⚡ ${isFa ? 'در حال اقدام' : 'Active'}</div>`
          });
        } else if (isCompleted) {
          canvas.addMarker(node.id, 'bpmn-node-completed');
          overlays.add(node.id, {
            position: { top: -14, right: 0 },
            html: `<div class="bpmn-overlay-badge bpmn-overlay-completed">✓ ${isFa ? 'انجام شد' : 'Done'}</div>`
          });
        } else if (isRejected) {
          canvas.addMarker(node.id, 'bpmn-node-rejected');
          overlays.add(node.id, {
            position: { top: -14, right: 0 },
            html: `<div class="bpmn-overlay-badge bpmn-overlay-rejected">✕ ${isFa ? 'متوقف/رد شده' : 'Rejected'}</div>`
          });
        }
      });
    } catch (e) {
      console.error('Error applying live tracking overlays:', e);
    }
  };

  const toggleLiveTracking = () => {
    if (!liveTrackingActive) {
      setLiveTrackingActive(true);
      fetchLiveInstances();
      toast.success(isFa ? 'حالت رهگیری زنده فرآیند فعال شد.' : 'Live Tracking enabled.');
    } else {
      setLiveTrackingActive(false);
      clearLiveTrackingOverlays();
      toast(isFa ? 'بازگشت به حالت طراحی فرآیند.' : 'Switched back to Design Mode.');
    }
  };

  useEffect(() => {
    if (liveTrackingActive && selectedInstance) {
      applyLiveTrackingOverlays(selectedInstance);
    }
  }, [liveTrackingActive, selectedInstance]);

  // Save to System
  const handleSaveCustom = async () => {
    if (!modeler) return;

    // Validate before saving
    const issues = runValidation();
    const fatalErrors = issues.filter(i => i.type === 'error');
    if (fatalErrors.length > 0) {
      setValidationModalOpen(true);
      toast.error(isFa ? 'قبل از ذخیره، خطاهای ساختاری فرآیند را برطرف نمایید.' : 'Resolve fatal validation errors before saving.');
      return;
    }

    try {
      setIsSaving(true);
      const { xml } = await modeler.saveXML({ format: true });

      const response = await axios.post('/api/v1/process-management/custom-save', {
        id: workflowId || undefined,
        xml,
        processName,
        moduleType,
        steps: steps.length ? steps : undefined
      });

      if (response.data.success) {
        toast.success(isFa ? 'فرآیند و تأییدکنندگان گام‌ها با موفقیت ذخیره شد.' : 'Process and step approvers saved.');
        fetchWorkflows();
        if (onSaved) onSaved();
      } else {
        toast.error(isFa ? 'خطا در ذخیره فرآیند' : 'Failed to save process');
      }
    } catch (error) {
      console.error(error);
      toast.error(isFa ? 'خطا در ارتباط با سرور' : 'Server connection error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStepApprovers = (updatedStep: WorkflowStep) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === updatedStep.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedStep;
        return next;
      }
      return [...prev, updatedStep];
    });

    // Update BPMN element visual label if name changed
    if (modeler && updatedStep.titleFa) {
      try {
        const elementRegistry = modeler.get('elementRegistry') as any;
        const modeling = modeler.get('modeling') as any;
        const elem = elementRegistry.get(updatedStep.id);
        if (elem && elem.businessObject && elem.businessObject.name !== updatedStep.titleFa) {
          modeling.updateLabel(elem, updatedStep.titleFa);
        }
      } catch (e) {
        console.error(e);
      }
    }

    toast.success(isFa ? `تأییدکنندگان مرحله «${updatedStep.titleFa}» با موفقیت تنظیم شد.` : 'Step approvers configured successfully.');
  };

  // Deploy to Camunda 8
  const handleDeploy = async () => {
    if (!modeler) return;

    const issues = runValidation();
    const fatalErrors = issues.filter(i => i.type === 'error');
    if (fatalErrors.length > 0) {
      setValidationModalOpen(true);
      toast.error(isFa ? 'فرآیند دارای خطای ساختاری است و قابل انتشار در Camunda نیست.' : 'Fix errors before deploying to Camunda.');
      return;
    }

    try {
      setIsDeploying(true);
      const { xml } = await modeler.saveXML({ format: true });

      const response = await axios.post('/api/v1/process-management/deploy', {
        xml,
        processName
      });

      if (response.data.success) {
        toast.success(isFa ? 'فرآیند با موفقیت در موتور Camunda 8 انتشار یافت.' : 'Process deployed successfully to Camunda 8.');
      } else {
        toast.error(isFa ? 'خطا در انتشار در Camunda' : 'Deployment failed');
      }
    } catch (error) {
      console.error(error);
      toast.error(isFa ? 'خطا در اتصال به موتور Camunda' : 'Camunda server error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Export XML
  const handleExportXml = async () => {
    if (!modeler) return;
    try {
      const { xml } = await modeler.saveXML({ format: true });
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName.replace(/\s+/g, '_') || 'process'}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isFa ? 'فایل BPMN 2.0 دانلود شد.' : 'BPMN 2.0 XML exported.');
    } catch (err) {
      toast.error(isFa ? 'خطا در خروجی XML' : 'Export XML failed');
    }
  };

  // Export SVG
  const handleExportSvg = async () => {
    if (!modeler) return;
    try {
      const { svg } = await modeler.saveSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName.replace(/\s+/g, '_') || 'process'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isFa ? 'فایل وکتور SVG دانلود شد.' : 'SVG exported.');
    } catch (err) {
      toast.error(isFa ? 'خطا در خروجی SVG' : 'Export SVG failed');
    }
  };

  // Export PNG
  const handleExportPng = async () => {
    if (!modeler) return;
    try {
      const { svg } = await modeler.saveSVG();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Give comfortable padding and high DPI resolution
        canvas.width = (img.width || 1400) * 1.5;
        canvas.height = (img.height || 900) * 1.5;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${processName.replace(/\s+/g, '_') || 'process'}.png`;
          a.click();
          toast.success(isFa ? 'تصویر PNG با کیفیت بالا دانلود شد.' : 'PNG image exported.');
        }
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (err) {
      toast.error(isFa ? 'خطا در تولید تصویر PNG' : 'Failed to export PNG');
    }
  };

  // Import File
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (modeler) {
        try {
          await modeler.importXML(content);
          const canvas = modeler.get('canvas') as any;
          canvas.zoom('fit-viewport');
          const cleanName = file.name.replace(/\.(bpmn|xml)$/i, '');
          setProcessName(cleanName);
          toast.success(isFa ? `فایل «${file.name}» با موفقیت وارد شد.` : 'Process imported successfully.');
        } catch (err) {
          console.error('Import failure', err);
          toast.error(isFa ? 'ساختار فایل BPMN معتبر نیست.' : 'Invalid BPMN XML file.');
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={`flex flex-col bpmn-editor-container ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-screen bg-white dark:bg-slate-900'
          : 'flex-1 h-full min-h-0 w-full'
      }`}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        accept=".bpmn,.xml"
        ref={fileInputRef}
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Top Application Bar & Controls */}
      <BpmnToolbar
        language={language}
        processName={processName}
        setProcessName={setProcessName}
        moduleType={moduleType}
        setModuleType={setModuleType}
        availableWorkflows={availableWorkflows}
        onLoadTemplate={handleLoadTemplate}
        onNewDiagram={handleNewDiagram}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onZoomReset={handleZoomReset}
        onDeleteSelected={handleDeleteSelected}
        onImportClick={() => fileInputRef.current?.click()}
        onExportXml={handleExportXml}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onSaveCustom={handleSaveCustom}
        onDeploy={handleDeploy}
        isSaving={isSaving}
        isDeploying={isDeploying}
        onValidate={handleValidateClick}
        validationIssueCount={validationIssues.length}
        liveTrackingActive={liveTrackingActive}
        onToggleLiveTracking={toggleLiveTracking}
        showProperties={showProperties}
        onToggleProperties={() => setShowProperties(!showProperties)}
        onOpenApproverMatrix={() => setApproverMatrixOpen(true)}
        approverCount={steps.filter(s => (s.assignedUsers && s.assignedUsers.length > 0) || s.assignedRole || s.assignedDepartment).length}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Live Execution Tracking Sub-bar (if active) */}
      {liveTrackingActive && (
        <BpmnLiveTrackingBar
          language={language}
          instances={liveInstances}
          selectedInstance={selectedInstance}
          onSelectInstance={(id) => {
            const found = liveInstances.find(i => i.id === id) || null;
            setSelectedInstance(found);
          }}
          onRefresh={fetchLiveInstances}
          onClose={() => {
            setLiveTrackingActive(false);
            clearLiveTrackingOverlays();
          }}
        />
      )}

      {/* Canvas & Properties Panel Working Stage */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Canvas Area (dir="ltr" ensures standard bpmn.io left palette docking) */}
        <div
          ref={containerRef}
          className="flex-1 bpmn-canvas-container relative w-full h-full min-h-0"
          style={{ minHeight: isFullscreen ? '100%' : '440px' }}
        />

        {/* Floating Selected Step Approver Quick Window */}
        {selectedTaskStep && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[94vw] sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-200 dark:border-indigo-800/80 rounded-2xl shadow-xl hover:shadow-2xl px-4 py-3 transition-all animate-in fade-in zoom-in-95 duration-150"
            dir={isFa ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between gap-3 sm:gap-6">
              {/* Step Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-xs">
                      {selectedTaskStep.titleFa}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {selectedTaskStep.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                    <span>{isFa ? 'تأییدکننده:' : 'Assignee:'}</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedTaskStep.assigneeType === 'user'
                        ? (selectedTaskStep.assignedUsers && selectedTaskStep.assignedUsers.length > 0
                            ? `${selectedTaskStep.assignedUsers.length} ${isFa ? 'کاربر انتخاب‌شده' : 'users'} (${selectedTaskStep.approvalLogic === 'all' ? (isFa ? 'اجماع کامل' : 'All') : selectedTaskStep.approvalLogic === 'any' ? (isFa ? 'اولین نفر' : 'Any') : (isFa ? 'به ترتیب' : 'Sequential')})`
                            : (isFa ? 'هنوز کاربری انتخاب نشده' : 'No users'))
                        : selectedTaskStep.assigneeType === 'role'
                        ? (isFa ? `نقش ${selectedTaskStep.assignedRole}` : `Role: ${selectedTaskStep.assignedRole}`)
                        : (isFa ? `واحد ${selectedTaskStep.assignedDepartment || 'نامشخص'}` : `Dept: ${selectedTaskStep.assignedDepartment || 'Unassigned'}`)}
                    </span>
                    {selectedTaskStep.slaHours && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {selectedTaskStep.slaHours} {isFa ? 'ساعت SLA' : 'hrs SLA'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProperties(true)}
                  className="p-1.5 sm:px-2.5 sm:py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-700"
                  title={isFa ? 'مشاهده در پنل مشخصات (Properties)' : 'View in Properties Panel'}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden sm:inline">{isFa ? 'مشخصات' : 'Properties'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStepForModal(selectedTaskStep)}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تعیین مسئول و تأییدکنندگان این مرحله' : 'Configure Approvers'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={isFa ? 'بستن' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Quick Keybind Legend (bpmn.io style) - Hidden when step window is open */}
        {!selectedTaskStep && (
          <div className="bpmn-floating-controls hidden md:flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium px-1">
              {isFa ? 'میانبرها:' : 'Hotkeys:'}
            </span>
            <span className="bpmn-key-badge">Ctrl+S</span>
            <span className="text-[10px] text-slate-400">{isFa ? 'ذخیره' : 'Save'}</span>
            <span className="bpmn-key-badge">Ctrl+Z</span>
            <span className="text-[10px] text-slate-400">{isFa ? 'Undo' : 'Undo'}</span>
            <span className="bpmn-key-badge">Ctrl+0</span>
            <span className="text-[10px] text-slate-400">{isFa ? 'تراز' : 'Fit'}</span>
            <span className="bpmn-key-badge">Del</span>
            <span className="text-[10px] text-slate-400">{isFa ? 'حذف' : 'Del'}</span>
            {isFullscreen && (
              <>
                <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <span className="bpmn-key-badge bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-300">Esc</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">{isFa ? 'خروج تمام‌صفحه' : 'Exit FS'}</span>
              </>
            )}
          </div>
        )}

        {/* Properties Panel Drawer */}
        <BpmnPropertiesPanel
          isOpen={showProperties}
          onClose={() => setShowProperties(false)}
          language={language}
          selectedElement={selectedElement}
          selectedTaskStep={selectedTaskStep}
          onUpdateStep={handleUpdateStep}
          onUpdateElementLabel={handleUpdateElementLabel}
          onOpenApproverModal={(step) => setSelectedStepForModal(step)}
          onOpenApproverMatrix={() => setApproverMatrixOpen(true)}
          processName={processName}
          setProcessName={setProcessName}
          moduleType={moduleType}
          setModuleType={setModuleType}
          allSteps={steps}
          propertiesPanelMountRef={propertiesRef as React.RefObject<HTMLDivElement>}
        />
      </div>

      {/* Validation Modal */}
      <BpmnValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        issues={validationIssues}
        language={language}
        onSelectElement={handleSelectElementFromValidation}
      />

      {/* Step Approver Configuration Modal */}
      {selectedStepForModal && (
        <StepApproverModal
          isOpen={Boolean(selectedStepForModal)}
          onClose={() => setSelectedStepForModal(null)}
          step={selectedStepForModal}
          onSaveStep={handleSaveStepApprovers}
          language={language}
        />
      )}

      {/* Workflow Approvers Matrix Drawer */}
      <WorkflowApproversMatrixDrawer
        isOpen={approverMatrixOpen}
        onClose={() => setApproverMatrixOpen(false)}
        steps={steps}
        onEditStep={(step) => {
          setSelectedStepForModal(step);
          setApproverMatrixOpen(false);
        }}
        language={language}
      />
    </div>
  );
}
