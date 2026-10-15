import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AuditedBIMElement } from '../types/bim';

interface ThreeBimViewerProps {
  elements: AuditedBIMElement[];
  colorBy: 'risk_level' | 'ifc_type' | 'concrete_grade';
  selectedStoreys: string[];
  selectedTypes: string[];
  showBoundingBoxes: boolean;
  onSelectElement: (element: AuditedBIMElement) => void;
  selectedElementTag?: string;
}

const TYPE_COLORS: Record<string, number> = {
  IfcFooting: 0xf59e0b, // Amber / Gold
  IfcColumn: 0x6366f1, // Indigo
  IfcBeam: 0x0284c7, // Cyan / Sky Blue
  IfcSlab: 0x10b981, // Emerald Green
  IfcWall: 0xec4899, // Rose Pink
  DEFAULT: 0x64748b, // Slate Grey
};

const RISK_COLORS: Record<string, number> = {
  HIGH: 0xef4444, // Crimson Alert
  MEDIUM: 0xf59e0b, // Warning Amber
  NORMAL: 0x0284c7, // Technical Blue
};

const GRADE_COLORS: Record<string, number> = {
  M20: 0x94a3b8,
  M25: 0x14b8a6,
  M30: 0x0284c7,
  M35: 0x6366f1,
  M40: 0x8b5cf6,
  M50: 0xd946ef,
  DEFAULT: 0x64748b,
};

export const ThreeBimViewer: React.FC<ThreeBimViewerProps> = ({
  elements,
  colorBy,
  selectedStoreys,
  selectedTypes,
  showBoundingBoxes,
  onSelectElement,
  selectedElementTag,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredElement, setHoveredElement] = useState<AuditedBIMElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = 520;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // Position camera for isometric architectural view
    camera.position.set(32, 28, 38);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(20, 40, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // Ground Grid
    const grid = new THREE.GridHelper(30, 15, 0x94a3b8, 0xe2e8f0);
    grid.position.y = -2.5;
    scene.add(grid);

    // Filter elements
    const visibleElements = elements.filter((el) => {
      const matchStorey = selectedStoreys.length === 0 || selectedStoreys.includes(el.storey);
      const matchType = selectedTypes.length === 0 || selectedTypes.includes(el.ifc_type);
      return matchStorey && matchType;
    });

    const meshMap = new Map<THREE.Mesh, AuditedBIMElement>();
    const elementMeshes: THREE.Mesh[] = [];

    // Target center
    const target = new THREE.Vector3(9.0, 5.0, 9.0);
    camera.lookAt(target);

    // Materials and geometry creation
    visibleElements.forEach((el) => {
      let colorHex = 0x64748b;
      if (colorBy === 'risk_level') {
        colorHex = RISK_COLORS[el.risk_level] || RISK_COLORS.NORMAL;
      } else if (colorBy === 'ifc_type') {
        colorHex = TYPE_COLORS[el.ifc_type] || TYPE_COLORS.DEFAULT;
      } else if (colorBy === 'concrete_grade') {
        colorHex = GRADE_COLORS[el.concrete_grade] || GRADE_COLORS.DEFAULT;
      }

      const isSelected = selectedElementTag === el.tag;
      if (isSelected) {
        colorHex = 0xff0055;
      }

      const dx = Math.max(0.15, el.bbox_dx || 0.5);
      const dy = Math.max(0.15, el.bbox_dy || 0.5);
      const dz = Math.max(0.15, el.bbox_dz || 0.5);

      const geom = new THREE.BoxGeometry(dx, dz, dy); // Note: Three.js Y is up, IFC Z is up!

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.45,
        metalness: 0.1,
        transparent: true,
        opacity: el.ifc_type === 'IfcSlab' ? 0.75 : 0.92,
      });

      const mesh = new THREE.Mesh(geom, mat);
      // In Three.js: X=X, Y=Z (up), Z=Y
      const posX = el.center_x ?? 0;
      const posY = el.center_z ?? 0;
      const posZ = el.center_y ?? 0;

      mesh.position.set(posX, posY, posZ);

      if (showBoundingBoxes) {
        const edges = new THREE.EdgesGeometry(geom);
        const lineMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xffffff : 0x0f172a,
          linewidth: isSelected ? 2 : 1,
          transparent: true,
          opacity: 0.35,
        });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        mesh.add(wireframe);
      }

      scene.add(mesh);
      meshMap.set(mesh, el);
      elementMeshes.push(mesh);
    });

    // Simple Orbit Controls Implementation
    let isDragging = false;
    let isRightDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.shiftKey) {
        isRightDragging = true;
      } else {
        isDragging = true;
      }
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      // Raycasting for hover
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObjects(elementMeshes);

      if (intersects.length > 0) {
        const topMesh = intersects[0].object as THREE.Mesh;
        const el = meshMap.get(topMesh);
        if (el) {
          setHoveredElement(el);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredElement(null);
        renderer.domElement.style.cursor = 'grab';
      }

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        spherical.theta -= deltaX * 0.007;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - deltaY * 0.007));
        camera.position.setFromSpherical(spherical).add(target);
        camera.lookAt(target);
      } else if (isRightDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        const panSpeed = 0.03;
        target.x -= deltaX * panSpeed;
        target.y += deltaY * panSpeed;
        camera.position.setFromSpherical(spherical).add(target);
        camera.lookAt(target);
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      isRightDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(10, Math.min(100, spherical.radius + e.deltaY * 0.05));
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObjects(elementMeshes);

      if (intersects.length > 0) {
        const topMesh = intersects[0].object as THREE.Mesh;
        const el = meshMap.get(topMesh);
        if (el) {
          onSelectElement(el);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('click', handleClick);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // Auto turntable rotation toggle
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 800;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, [elements, colorBy, selectedStoreys, selectedTypes, showBoundingBoxes, selectedElementTag, onSelectElement]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900/5">
      <div ref={containerRef} className="w-full h-[520px] cursor-grab active:cursor-grabbing" />

      {/* Floating Instructions Banner */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/80 text-[11px] font-medium text-slate-700 shadow-sm flex items-center gap-3">
        <span>🖱️ <b>Left-Click + Drag:</b> Rotate</span>
        <span className="text-slate-300">|</span>
        <span><b>Right-Click / Shift:</b> Pan</span>
        <span className="text-slate-300">|</span>
        <span><b>Scroll:</b> Zoom</span>
        <span className="text-slate-300">|</span>
        <span className="text-indigo-600 font-semibold">Click element to inspect</span>
      </div>

      {/* Floating Tooltip for Hovered Element */}
      {hoveredElement && (
        <div
          className="absolute pointer-events-none bg-slate-900/95 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs z-20 min-w-[210px]"
          style={{
            left: Math.min(mousePos.x + 14, (containerRef.current?.clientWidth || 800) - 230),
            top: Math.max(10, mousePos.y - 80),
          }}
        >
          <div className="font-bold text-sm text-amber-400 mb-1">{hoveredElement.name}</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
            <span className="text-slate-400">Class:</span>
            <span className="font-medium text-slate-200">{hoveredElement.ifc_type.replace('Ifc', '')}</span>
            <span className="text-slate-400">Level:</span>
            <span className="font-medium text-slate-200">{hoveredElement.storey}</span>
            <span className="text-slate-400">Grade:</span>
            <span className="font-medium text-emerald-400">{hoveredElement.concrete_grade}</span>
            <span className="text-slate-400">Net Volume:</span>
            <span className="font-medium text-slate-200">{hoveredElement.concrete_vol_cum.toFixed(3)} m³</span>
            <span className="text-slate-400">Cost:</span>
            <span className="font-medium text-amber-300">₹{hoveredElement.total_cost_inr.toLocaleString()}</span>
            <span className="text-slate-400">Risk:</span>
            <span
              className={`font-bold ${
                hoveredElement.risk_level === 'HIGH'
                  ? 'text-red-400'
                  : hoveredElement.risk_level === 'MEDIUM'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {hoveredElement.risk_level}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
