import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Camera, Maximize2, RotateCcw, Eye, SlidersHorizontal, Download } from 'lucide-react';
import type { LiftingPlanRecord, LiftingCrane, FullPlanEvaluationResult } from '../types';

export interface Lifting3DViewportHandle {
  captureSnapshot: () => string | null;
}

interface Props {
  plan: LiftingPlanRecord;
  crane?: LiftingCrane | null;
  tailCrane?: LiftingCrane | null;
  evaluation?: FullPlanEvaluationResult | null;
  turningAngleDeg?: number;
  onTurningAngleChange?: (deg: number) => void;
  onSnapshot?: (dataUrl: string) => void;
  heightClass?: string;
}

type CameraPreset = 'PERSPECTIVE' | 'TOP' | 'SIDE' | 'FRONT';

const Lifting3DViewport = forwardRef<Lifting3DViewportHandle, Props>(function Lifting3DViewport(
  {
    plan,
    crane,
    tailCrane,
    evaluation,
    turningAngleDeg,
    onTurningAngleChange,
    onSnapshot,
    heightClass = 'h-[460px]',
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const renderScheduledRef = useRef(false);

  const [webglError, setWebglError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showRadiusCircle, setShowRadiusCircle] = useState(true);
  const [showExclusionZone, setShowExclusionZone] = useState(true);
  const [showForceVectors, setShowForceVectors] = useState(true);
  const [localAngleDeg, setLocalAngleDeg] = useState<number>(turningAngleDeg ?? Number(plan.turningConfig?.previewAngleDeg ?? 0));

  useEffect(() => {
    if (turningAngleDeg !== undefined) {
      setLocalAngleDeg(turningAngleDeg);
    }
  }, [turningAngleDeg]);

  const scheduleRender = useCallback(() => {
    if (renderScheduledRef.current) return;
    renderScheduledRef.current = true;
    requestAnimationFrame(() => {
      renderScheduledRef.current = false;
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (r && s && c) {
        r.render(s, c);
      }
    });
  }, []);

  const captureSnapshot = useCallback((): string | null => {
    const r = rendererRef.current;
    const s = sceneRef.current;
    const c = cameraRef.current;
    if (!r || !s || !c) return null;
    try {
      r.render(s, c);
      return r.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  useImperativeHandle(ref, () => ({ captureSnapshot }), [captureSnapshot]);

  const applyCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const cam = cameraRef.current;
      const ctrls = controlsRef.current;
      if (!cam || !ctrls) return;
      const target = new THREE.Vector3(0, 4.5, 0);
      if (preset === 'PERSPECTIVE') {
        cam.position.set(18, 14, 20);
      } else if (preset === 'TOP') {
        cam.position.set(0, 32, 0.01);
        target.set(0, 0, 0);
      } else if (preset === 'SIDE') {
        cam.position.set(0, 8, 28);
      } else if (preset === 'FRONT') {
        cam.position.set(28, 8, 0);
      }
      ctrls.target.copy(target);
      ctrls.update();
      scheduleRender();
    },
    [scheduleRender]
  );

  // Initialize WebGLRenderer, Scene, RoomEnvironment, Ground Grid, OrbitControls ONCE
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true, // Needed for clean PDF/Word PNG snapshot
        powerPreference: 'high-performance',
      });
    } catch (err: any) {
      setWebglError('امکان راه‌اندازی موتور سه‌بعدی WebGL در مرورگر فعلی وجود ندارد.');
      return;
    }

    const gl = renderer.getContext();
    let isSoftwareGl = false;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glStr);
    } catch {}

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 460);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('زمینه گرافیکی WebGL موقتاً متوقف شد. برای بازنشانی کلیک کنید.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
      scheduleRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.FogExp2('#0f172a', 0.0085);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(
      44,
      (container.clientWidth || 800) / Math.max(1, container.clientHeight || 460),
      0.2,
      260
    );
    camera.position.set(18, 14, 20);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; // Zero unnecessary animation loop overhead; direct crisp render on change
    controls.minDistance = 5;
    controls.maxDistance = 85;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.target.set(0, 4.5, 0);
    controls.update();
    controls.addEventListener('change', scheduleRender);
    controlsRef.current = controls;

    // 3-Point Industrial Lighting
    const hemi = new THREE.HemisphereLight('#e2e8f0', '#334155', 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff7ed', 2.0);
    keyLight.position.set(22, 32, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 90;
      const d = 24;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#bae6fd', 0.65);
    rimLight.position.set(-20, 14, -18);
    scene.add(rimLight);

    // Concrete Industrial Ground + Grid
    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.92,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(70, 35, '#475569', '#334155');
    grid.position.y = 0.01;
    scene.add(grid);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    dynamicGroupRef.current = dynamicGroup;

    const resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(100, entry.contentRect.width);
        const h = Math.max(100, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        scheduleRender();
      }
    });
    resizeObs.observe(container);

    scheduleRender();

    return () => {
      resizeObs.disconnect();
      controls.removeEventListener('change', scheduleRender);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      dynamicGroupRef.current = null;
    };
  }, [scheduleRender]);

  // Rebuild Parametric Scene Meshes whenever Plan/Crane/Evaluation/Angle updates
  useEffect(() => {
    const group = dynamicGroupRef.current;
    if (!group) return;

    // Clear and dispose prior dynamic geometries/materials
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    const craneYellow = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.35, metalness: 0.45 });
    const craneDark = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6, metalness: 0.65 });
    const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.35, metalness: 0.78 });
    const vesselMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.32, metalness: 0.72 });
    const padeyeMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.4, metalness: 0.6 });
    const safetyZoneMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const radiusMat = new THREE.LineBasicMaterial({ color: '#38bdf8' });

    const radiusM = Math.max(4, Math.min(45, Number(plan.craneSetup?.radiusM || 12)));
    const boomLenM = Math.max(radiusM + 4, Math.min(60, Number(plan.craneSetup?.boomLengthM || 24)));
    const outriggerSpreadM = Math.max(4, Number(plan.craneSetup?.outriggerSpreadM || crane?.outriggerSpreadM || 7.5));

    const loadLen = Math.max(1.2, Number(plan.loadDimensions?.lengthM || 6));
    const loadWid = Math.max(0.8, Number(plan.loadDimensions?.widthM || plan.loadDimensions?.diameterM || 2.2));
    const loadHgt = Math.max(0.8, Number(plan.loadDimensions?.heightM || plan.loadDimensions?.diameterM || 2.2));

    const isTurning = Boolean(plan.turningConfig?.enabled || plan.liftCategory === 'LIFT_AND_TURN');
    const isTandem = Boolean(plan.tandemConfig?.enabled || plan.liftCategory === 'TANDEM' || isTurning);
    const isBlind = Boolean(plan.blindConfig?.enabled || plan.liftCategory === 'BLIND');

    // -----------------------------------------
    // Helper: Build Procedural Multi-Part Crane
    // -----------------------------------------
    const buildCrane = (baseX: number, baseZ: number, targetHookPos: THREE.Vector3, bLen: number, isTail = false) => {
      const craneGroup = new THREE.Group();
      craneGroup.position.set(baseX, 0, baseZ);

      const dx = targetHookPos.x - baseX;
      const dz = targetHookPos.z - baseZ;
      const yaw = Math.atan2(dx, dz);

      // 1. Carrier chassis + wheels
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 7.6), craneDark);
      chassis.position.set(0, 1.0, 0);
      chassis.castShadow = true;
      craneGroup.add(chassis);

      for (const wz of [-2.8, -1.0, 1.0, 2.8]) {
        for (const wx of [-1.4, 1.4]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), craneDark);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.55, wz);
          craneGroup.add(wheel);
        }
      }

      // 2. 4 Outriggers + Float Pads
      const halfSpread = outriggerSpreadM / 2;
      for (const ox of [-halfSpread, halfSpread]) {
        for (const oz of [-3.0, 3.0]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(ox), 0.25, 0.28), craneYellow);
          beam.position.set(ox / 2, 0.72, oz);
          craneGroup.add(beam);

          const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 10), steelMat);
          jack.position.set(ox, 0.42, oz);
          craneGroup.add(jack);

          const pad = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.95), craneDark);
          pad.position.set(ox, 0.06, oz);
          craneGroup.add(pad);
        }
      }

      // 3. Slewing Superstructure + Operator Cab + Counterweight
      const slewGroup = new THREE.Group();
      slewGroup.position.set(0, 1.55, 0);
      slewGroup.rotation.y = yaw;

      const house = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, 4.2), isTail ? steelMat : craneYellow);
      house.position.set(0, 0.7, -0.5);
      house.castShadow = true;
      slewGroup.add(house);

      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.35, 1.7),
        new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.2, metalness: 0.5 })
      );
      cab.position.set(1.2, 0.85, 0.7);
      slewGroup.add(cab);

      const cwt = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 1.4), craneDark);
      cwt.position.set(0, 0.9, -2.9);
      cwt.castShadow = true;
      slewGroup.add(cwt);

      // 4. Boom Vector Calculation to reach directly over targetHookPos
      const horizDist = Math.max(3, Math.hypot(dx, dz));
      const pivotY = 2.6;
      const effectiveBoomLen = Math.max(horizDist + 1.5, bLen);
      const tipRelY = Math.sqrt(Math.max(4, effectiveBoomLen * effectiveBoomLen - horizDist * horizDist));
      const boomAngle = Math.atan2(tipRelY, horizDist);

      // Two-section telescopic boom
      const baseBoomLen = effectiveBoomLen * 0.56;
      const flyBoomLen = effectiveBoomLen * 0.46;

      const boomRoot = new THREE.Group();
      boomRoot.position.set(0, 1.1, -0.4);
      boomRoot.rotation.x = -boomAngle;

      const sec1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, baseBoomLen), isTail ? steelMat : craneYellow);
      sec1.position.set(0, 0, baseBoomLen / 2);
      sec1.castShadow = true;
      boomRoot.add(sec1);

      const sec2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, flyBoomLen), steelMat);
      sec2.position.set(0, 0, baseBoomLen + flyBoomLen / 2 - 0.5);
      sec2.castShadow = true;
      boomRoot.add(sec2);

      slewGroup.add(boomRoot);
      craneGroup.add(slewGroup);

      // Tip world position (directly above hook)
      const tipWorldY = pivotY + tipRelY;
      const tipWorld = new THREE.Vector3(targetHookPos.x, Math.max(targetHookPos.y + 1.8, tipWorldY), targetHookPos.z);

      // Main Hoist Rope + Hook Block
      const ropeLen = Math.max(0.8, tipWorld.y - targetHookPos.y);
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, ropeLen, 8),
        steelMat
      );
      rope.position.set(targetHookPos.x, targetHookPos.y + ropeLen / 2, targetHookPos.z);
      group.add(rope);

      const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.45), craneYellow);
      hookBlock.position.set(targetHookPos.x, targetHookPos.y + 0.32, targetHookPos.z);
      hookBlock.castShadow = true;
      group.add(hookBlock);

      return { craneGroup };
    };

    // -----------------------------------------
    // Load Assembly (rotated cleanly for Lifting & Turning)
    // -----------------------------------------
    const pitchRad = THREE.MathUtils.degToRad(isTurning ? localAngleDeg : 0);
    const loadBaseY = isTurning ? 1.5 + Math.sin(pitchRad) * (loadLen * 0.42) : 3.2;

    const loadGroup = new THREE.Group();
    loadGroup.position.set(0, loadBaseY, 0);
    loadGroup.rotation.z = pitchRad;

    if (plan.loadShape === 'VESSEL_HORIZONTAL' || plan.loadShape === 'EXCHANGER') {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(loadWid * 0.5, loadWid * 0.5, loadLen, 28),
        vesselMat
      );
      shell.rotation.z = Math.PI / 2;
      shell.castShadow = true;
      loadGroup.add(shell);

      // End heads
      for (const sx of [-loadLen / 2, loadLen / 2]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(loadWid * 0.5, 20, 14), vesselMat);
        cap.scale.set(0.45, 1, 1);
        cap.position.set(sx, 0, 0);
        loadGroup.add(cap);
      }
    } else if (plan.loadShape === 'CYLINDER_VERTICAL') {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(loadWid * 0.5, loadWid * 0.5, loadHgt, 28),
        vesselMat
      );
      shell.castShadow = true;
      loadGroup.add(shell);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(loadLen, loadHgt, loadWid), vesselMat);
      box.castShadow = true;
      loadGroup.add(box);
    }

    // Center of Gravity (CoG) Marker + Plumb Line
    const cogX = Number(plan.cogOffset?.x || 0);
    const cogY = Number(plan.cogOffset?.y || 0);
    const cogZ = Number(plan.cogOffset?.z || 0);
    const cogSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    );
    cogSphere.position.set(cogX, cogY, cogZ);
    loadGroup.add(cogSphere);

    group.add(loadGroup);

    // Compute world CoG & plumb projection
    loadGroup.updateMatrixWorld(true);
    const cogWorld = new THREE.Vector3(cogX, cogY, cogZ).applyMatrix4(loadGroup.matrixWorld);
    const plumbPts = [cogWorld, new THREE.Vector3(cogWorld.x, 0.05, cogWorld.z)];
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(plumbPts),
        new THREE.LineBasicMaterial({ color: '#f87171' })
      )
    );

    // Attachment points -> Hooks & Slings
    const defaultPts = evaluation?.riggingResult?.legs?.length
      ? evaluation.riggingResult.legs
      : [
          { label: 'P1', horizontalAngleDeg: 55, axialTensionTon: 3, slingUtilizationPct: 40 },
          { label: 'P2', horizontalAngleDeg: 55, axialTensionTon: 3, slingUtilizationPct: 40 },
        ];

    const attachLocal: THREE.Vector3[] = Array.isArray(plan.riggingSetup?.attachmentPoints) && plan.riggingSetup.attachmentPoints.length > 0
      ? plan.riggingSetup.attachmentPoints.map((p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z))
      : isTurning
        ? [
            new THREE.Vector3(loadLen * 0.42, loadWid * 0.55, 0),
            new THREE.Vector3(-loadLen * 0.42, loadWid * 0.55, 0),
          ]
        : [
            new THREE.Vector3(loadLen * 0.35, loadHgt * 0.52, loadWid * 0.35),
            new THREE.Vector3(-loadLen * 0.35, loadHgt * 0.52, loadWid * 0.35),
            new THREE.Vector3(-loadLen * 0.35, loadHgt * 0.52, -loadWid * 0.35),
            new THREE.Vector3(loadLen * 0.35, loadHgt * 0.52, -loadWid * 0.35),
          ];

    const hookH = Number(plan.riggingSetup?.hookHeightM || loadHgt * 0.5 + 2.8);
    const mainHookWorld = isTurning
      ? new THREE.Vector3(loadLen * 0.42 * Math.cos(pitchRad), loadBaseY + loadLen * 0.42 * Math.sin(pitchRad) + 2.6, 0)
      : new THREE.Vector3(Number(plan.riggingSetup?.hookX || 0), loadBaseY + hookH, Number(plan.riggingSetup?.hookZ || 0));

    const arrType = evaluation?.riggingResult?.arrangementType || plan.riggingSetup?.arrangementType;
    const isBeamMode = arrType === 'SPREADER_BEAM' || arrType === 'LIFTING_BEAM';
    const spreaderY = loadBaseY + Math.max(loadHgt * 0.5 + 1.4, hookH - 1.3);
    const maxGovT = Math.max(1, evaluation?.riggingResult?.governingLegTensionTon || 5);

    if (isBeamMode && !isTurning) {
      const beamSpan = Math.max(2.2, loadLen * 0.78);
      const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(beamSpan, 0.28, 0.32), craneYellow);
      beamMesh.position.set(mainHookWorld.x, spreaderY, mainHookWorld.z);
      beamMesh.castShadow = true;
      group.add(beamMesh);

      // Upper 2-leg bridle from Main Hook down to Spreader Beam ends
      for (const sx of [-beamSpan * 0.42, beamSpan * 0.42]) {
        const endPt = new THREE.Vector3(mainHookWorld.x + sx, spreaderY + 0.14, mainHookWorld.z);
        const topDir = new THREE.Vector3().subVectors(mainHookWorld, endPt);
        const topCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.036, Math.max(0.1, topDir.length()), 8),
          steelMat
        );
        topCyl.position.copy(endPt).addScaledVector(topDir, 0.5);
        topCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), topDir.normalize());
        group.add(topCyl);
      }
    }

    // Draw Padeyes, Color-Coded / Slack Slings & 3D Force Vector Arrows
    const rawPts = plan.riggingSetup?.attachmentPoints || [];
    attachLocal.forEach((ptLocal, idx) => {
      const padMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.14), padeyeMat);
      padMesh.position.copy(ptLocal);
      loadGroup.add(padMesh);

      if (isTurning && idx === 1) return; // Tail attachment goes to tail crane below

      const ptWorld = ptLocal.clone().applyMatrix4(loadGroup.matrixWorld);
      const legEval: any = defaultPts[idx];
      const util = legEval?.slingUtilizationPct ?? 45;
      const angle = legEval?.horizontalAngleDeg ?? 60;
      const pStatus = legEval?.participationStatus || 'ACTIVE';
      const isSlack = pStatus === 'SLACK' || pStatus === 'DROPPED_RIGID_ENVELOPE';

      // Determine upper target position (explicit upperPosition -> spreader bar -> main hook)
      const explicitUpper = rawPts[idx]?.upperPosition;
      let upperWorld = mainHookWorld;
      if (explicitUpper && !isTurning) {
        upperWorld = new THREE.Vector3(explicitUpper.x, loadBaseY + explicitUpper.y, explicitUpper.z);
      } else if (isBeamMode && !isTurning) {
        const beamSpan = Math.max(2.2, loadLen * 0.78);
        const clampedX = Math.max(-beamSpan * 0.46, Math.min(beamSpan * 0.46, ptWorld.x));
        upperWorld = new THREE.Vector3(clampedX, spreaderY - 0.12, ptWorld.z * 0.15);
      }

      const slingColor = isSlack
        ? '#64748b'
        : pStatus === 'UNVERIFIED'
          ? '#a855f7'
          : util > 100 || angle < 30
            ? '#ef4444'
            : util >= 75 || angle < 45
              ? '#f59e0b'
              : '#10b981';

      if (isSlack) {
        // Sagged quadratic curve for slack/unloaded sling
        const midPt = new THREE.Vector3().addVectors(ptWorld, upperWorld).multiplyScalar(0.5);
        midPt.y -= 0.42;
        midPt.x += (ptWorld.x >= 0 ? 0.18 : -0.18);
        const curve = new THREE.QuadraticBezierCurve3(ptWorld, midPt, upperWorld);
        const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.032, 6, false);
        const slackMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7, transparent: true, opacity: 0.65 });
        group.add(new THREE.Mesh(tubeGeo, slackMat));
      } else {
        const dir = new THREE.Vector3().subVectors(upperWorld, ptWorld);
        const len = dir.length();
        const slingCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.038, Math.max(0.1, len), 8),
          new THREE.MeshStandardMaterial({ color: slingColor, roughness: 0.4, metalness: 0.5 })
        );
        slingCyl.position.copy(ptWorld).addScaledVector(dir, 0.5);
        slingCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        group.add(slingCyl);
      }

      // 3D Force Vector Arrow proportional to calculated axial tension
      if (showForceVectors && legEval?.forceVectorTon && !isSlack) {
        const fv = legEval.forceVectorTon;
        const vec = new THREE.Vector3(fv.x || 0, fv.y || 0, fv.z || 0);
        const mag = vec.length();
        if (mag > 0.01) {
          const arrowLen = Math.max(0.75, Math.min(2.6, (mag / maxGovT) * 2.2));
          const arrowColor = util > 100 ? 0xef4444 : util >= 75 ? 0xf59e0b : 0x38bdf8;
          const arrow = new THREE.ArrowHelper(vec.normalize(), ptWorld, arrowLen, arrowColor, 0.34, 0.18);
          group.add(arrow);
        }
      }
    });

    // Primary Crane
    const crane1X = -radiusM * 0.72;
    const crane1Z = radiusM * 0.69;
    const { craneGroup: crane1Group } = buildCrane(crane1X, crane1Z, mainHookWorld, boomLenM, false);
    group.add(crane1Group);

    // Working Radius Ring around Primary Crane
    if (showRadiusCircle) {
      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(crane1X + Math.cos(th) * radiusM, 0.05, crane1Z + Math.sin(th) * radiusM));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), radiusMat));
    }

    // Safety Exclusion Perimeter around Lift Area
    if (showExclusionZone) {
      const exRadius = Math.max(loadLen, loadWid) + 2.5;
      const exRing = new THREE.Mesh(new THREE.RingGeometry(exRadius - 0.35, exRadius, 48), safetyZoneMat);
      exRing.rotation.x = -Math.PI / 2;
      exRing.position.set(0, 0.03, 0);
      group.add(exRing);
    }

    // Secondary / Tail Crane (Tandem or Lifting & Turning)
    if (isTandem) {
      const tailTarget = isTurning
        ? attachLocal[1].clone().applyMatrix4(loadGroup.matrixWorld).add(new THREE.Vector3(0, 2.2, 0))
        : new THREE.Vector3(-loadLen * 0.35, mainHookWorld.y, 0);

      if (isTurning && attachLocal[1]) {
        const tailAttachW = attachLocal[1].clone().applyMatrix4(loadGroup.matrixWorld);
        const tailDir = new THREE.Vector3().subVectors(tailTarget, tailAttachW);
        const tailSling = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.038, Math.max(0.1, tailDir.length()), 8),
          new THREE.MeshStandardMaterial({ color: localAngleDeg >= 85 ? '#64748b' : '#38bdf8', roughness: 0.4 })
        );
        tailSling.position.copy(tailAttachW).addScaledVector(tailDir, 0.5);
        tailSling.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tailDir.normalize());
        group.add(tailSling);
      }

      const { craneGroup: crane2Group } = buildCrane(radiusM * 0.72, -radiusM * 0.65, tailTarget, boomLenM * 0.9, true);
      group.add(crane2Group);
    }

    // Blind Lift Obstruction Wall & Signaler Spotter
    if (isBlind) {
      const wallH = Math.max(3, Number(plan.blindConfig?.obstructionHeightM || 5.5));
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, wallH, 9),
        new THREE.MeshStandardMaterial({ color: '#64748b', transparent: true, opacity: 0.55, roughness: 0.8 })
      );
      wall.position.set(-radiusM * 0.35, wallH / 2, radiusM * 0.35);
      wall.rotation.y = Math.PI / 4;
      group.add(wall);

      // Signaler / Spotter figure at corner with clear view
      const spotter = new THREE.Group();
      spotter.position.set(loadLen * 0.55 + 1.8, 0, loadWid * 0.55 + 1.5);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.35, 12), padeyeMat);
      body.position.y = 0.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), craneYellow);
      head.position.y = 1.55;
      spotter.add(body, head);
      group.add(spotter);
    }

    scheduleRender();
  }, [plan, crane, tailCrane, evaluation, localAngleDeg, showRadiusCircle, showExclusionZone, showForceVectors, scheduleRender]);

  const statusText = evaluation?.overallStatus || plan.engineeringStatus || 'NOT_VERIFIED';

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 select-none`}>
      {webglError ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-200 gap-2">
          <p className="text-sm font-bold text-amber-400">{webglError}</p>
          <p className="text-xs text-slate-400">محاسبات مهندسی و گزارش‌گیری بدون اختلال فعال هستند.</p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}

      {/* Top Left Camera Presets */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg p-1 text-[11px] text-slate-100">
        <button
          type="button"
          onClick={() => applyCameraPreset('PERSPECTIVE')}
          className="px-2 py-1 rounded hover:bg-slate-800 whitespace-nowrap"
        >
          سه‌بعدی
        </button>
        <button
          type="button"
          onClick={() => applyCameraPreset('TOP')}
          className="px-2 py-1 rounded hover:bg-slate-800 whitespace-nowrap"
        >
          نمای بالا
        </button>
        <button
          type="button"
          onClick={() => applyCameraPreset('SIDE')}
          className="px-2 py-1 rounded hover:bg-slate-800 whitespace-nowrap"
        >
          جانبی
        </button>
        <button
          type="button"
          onClick={() => {
            const url = captureSnapshot();
            if (url && onSnapshot) onSnapshot(url);
            else if (url) {
              const a = document.createElement('a');
              a.href = url;
              a.download = `${plan.planCode || 'lifting-3d'}.png`;
              a.click();
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold whitespace-nowrap"
          title="ثبت تصویر 3D برای گزارش مهندسی"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>اسنپ‌شات گزارش</span>
        </button>
      </div>

      {/* Top Right Telemetry Readout (clean, tabular-nums) */}
      <div className="absolute top-3 right-3 z-10 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-[11px] text-slate-200 space-y-1 text-right">
        <div className="font-bold text-white flex items-center justify-between gap-3">
          <span>مدل پارامتریک سه‌بعدی باربرداری</span>
          <span className="font-mono tabular-nums text-sky-400">{statusText}</span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300">
          <span>شعاع: {plan.craneSetup?.radiusM || 12}m</span>
          <span>·</span>
          <span>بوم: {plan.craneSetup?.boomLengthM || 24}m</span>
          <span>·</span>
          <span>وزن خالص: {plan.netLoadWeightTon}t</span>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (per Three.js skill) */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-950/85 border border-slate-700/80 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setControlsOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sky-400 font-bold hover:text-sky-300"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{controlsOpen ? 'بستن کنترل‌ها' : 'کنترل‌های صحنه'}</span>
          </button>

          {controlsOpen && (
            <>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRadiusCircle}
                  onChange={(e) => setShowRadiusCircle(e.target.checked)}
                  className="accent-sky-500"
                />
                <span>شعاع کاری</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExclusionZone}
                  onChange={(e) => setShowExclusionZone(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>حریم ایمن</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showForceVectors}
                  onChange={(e) => setShowForceVectors(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>بردار نیروی شاخه‌ها</span>
              </label>

              {(plan.turningConfig?.enabled || plan.liftCategory === 'LIFT_AND_TURN') && (
                <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
                  <span className="text-amber-300 font-bold">زاویه برپاسازی (Turning):</span>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={5}
                    value={localAngleDeg}
                    onChange={(e) => {
                      const deg = Number(e.target.value);
                      setLocalAngleDeg(deg);
                      onTurningAngleChange?.(deg);
                    }}
                    className="w-28 accent-amber-500"
                  />
                  <span className="font-mono tabular-nums font-bold text-white">{localAngleDeg}°</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default Lifting3DViewport;
