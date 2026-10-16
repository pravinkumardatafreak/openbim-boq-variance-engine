export interface VisionInspectionFeed {
  id: string;
  title: string;
  site_location: string;
  source_type: 'Autonomous Drone' | 'Fixed Crane Camera' | 'Quadruped Robot (SLAM)' | '3D LiDAR Scanner';
  target_element_tag: string;
  target_element_name: string;
  ifc_class: string;
  work_stage: string;
  inspection_status: 'DEFECT_DETECTED' | 'SAFETY_VIOLATION' | 'COMPLIANT' | 'DIMENSIONAL_VARIANCE';
  confidence_pct: number;
  detections: Array<{
    label: string;
    type: 'defect' | 'structure' | 'safety' | 'rebar';
    confidence: number;
    bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in %
    severity?: 'HIGH' | 'MEDIUM' | 'LOW';
    detail: string;
  }>;
  lidar_deviation_mm?: number;
  tolerance_status?: 'WITHIN_TOLERANCE' | 'OUT_OF_TOLERANCE';
  vlm_ncr_memo: {
    ncr_number: string;
    contractor_subcontractor: string;
    clause_reference: string;
    confidence_breakdown: {
      overall_pct: number;
      sensor_grounding: string;
      point_cloud_tolerance: string;
      bayesian_posterior: number;
    };
    shapley_commercial_attribution: {
      baseline_expected_cost: number;
      surges: Array<{
        feature: string;
        impact_inr: number;
        impact_pct: number;
        direction: 'increase' | 'decrease';
        plain_explanation: string;
      }>;
      final_billed_risk: number;
    };
    visual_finding: string;
    bim_variance_finding: string;
    corrective_action: string;
    financial_retention_inr: number;
  };
  edge_profiler: {
    target_hardware: string;
    runtime: string;
    latency_ms: number;
    throughput_fps: number;
    power_draw_watts: number;
    memory_footprint_mb: number;
    quantization: 'INT8' | 'FP16' | 'FP32';
  };
}

export const LT_VISION_INSPECTION_FEEDS: Record<string, VisionInspectionFeed> = {
  drone_column_pour: {
    id: 'drone_column_pour',
    title: '🚁 Drone Flight 04: L2 Column C-GF-32 Pre-Pour Rebar & Sizing QA/QC',
    site_location: 'Commercial Complex Tower B - Grid B4 (Floor 1 Transfer Zone)',
    source_type: 'Autonomous Drone',
    target_element_tag: '#32',
    target_element_name: 'C-GF-32',
    ifc_class: 'IfcColumn',
    work_stage: 'Rebar Cage Tying & Shuttering Pre-Pour Inspection',
    inspection_status: 'DIMENSIONAL_VARIANCE',
    confidence_pct: 96.4,
    detections: [
      {
        label: 'Oversized Shuttering Box (900x900 mm)',
        type: 'structure',
        confidence: 0.98,
        bbox: [20, 25, 75, 75],
        severity: 'HIGH',
        detail: 'Formwork dimension measured 900x900 mm vs IFC designed 450x450 mm. Volumetric surge of 6.8 m³ vs 0.73 m³.',
      },
      {
        label: 'Rebar Cover Deficit (18 mm < 40 mm IS-456)',
        type: 'defect',
        confidence: 0.94,
        bbox: [35, 60, 55, 72],
        severity: 'HIGH',
        detail: 'Clear cover to main longitudinal bars measured 18 mm, violating IS-456 Table 16 minimum 40 mm severe exposure cover.',
      },
      {
        label: 'TMT Longitudinal Fe-500D Reinforcement',
        type: 'rebar',
        confidence: 0.97,
        bbox: [28, 30, 70, 68],
        detail: '12 nos 25mm dia bars detected with 8mm ties @ 150mm c/c spacing.',
      },
    ],
    lidar_deviation_mm: 450,
    tolerance_status: 'OUT_OF_TOLERANCE',
    vlm_ncr_memo: {
      ncr_number: 'L&T-NCR-2026-CV-018',
      contractor_subcontractor: 'Apex Reinforced Structures Pvt Ltd',
      clause_reference: 'CPWD Spec Section 5.3 & IS-456 Clause 26.4.2 (Nominal Cover to Reinforcement)',
      confidence_breakdown: {
        overall_pct: 96.4,
        sensor_grounding: 'DJI Matrice 350 RTK / 4K Zenmuse H20T (GSD: 0.75 mm/px)',
        point_cloud_tolerance: '±3.8 mm registration residual vs IFC #32',
        bayesian_posterior: 0.982,
      },
      shapley_commercial_attribution: {
        baseline_expected_cost: 7800,
        surges: [
          {
            feature: 'Formwork Volumetric Surge (900x900 mm profile)',
            impact_inr: 60600,
            impact_pct: 776.9,
            direction: 'increase',
            plain_explanation: 'Oversized shuttering increases concrete demand from 0.73 m³ to 6.8 m³ (6.07 m³ excess).',
          },
          {
            feature: 'IS-456 Clear Cover Deficit (18 mm vs 40 mm)',
            impact_inr: 18000,
            impact_pct: 230.8,
            direction: 'increase',
            plain_explanation: 'Severe durability exposure risk requires shuttering strike, re-tying, and 40 mm cover spacer installation.',
          },
          {
            feature: 'Fe-500D TMT Reinforcement Verification',
            impact_inr: 5000,
            impact_pct: 64.1,
            direction: 'increase',
            plain_explanation: 'Cage tie wire density and stirrups meet seismic ductile detailing requirements.',
          },
        ],
        final_billed_risk: 91400,
      },
      visual_finding:
        'Drone photogrammetry confirms formwork shuttering constructed to 900x900 mm profile instead of 450x450 mm architectural design schedule. Reinforcement cage ties lack cover spacers on east face (18 mm clear cover).',
      bim_variance_finding:
        'IFC Tag #32 designed net volume 0.73 m³; physical shuttering configuration requires 6.8 m³ of M35 concrete (₹68,400 billed vs ₹7,800 design limit).',
      corrective_action:
        'Issue immediate stop-pour notice on grid B4. Dismantle shuttering and install 40 mm PVC cover blocks prior to concrete placement.',
      financial_retention_inr: 60600,
    },
    edge_profiler: {
      target_hardware: 'NVIDIA Jetson Orin Nano (8GB)',
      runtime: 'TensorRT 10.3 / DeepStream 7.1',
      latency_ms: 11.8,
      throughput_fps: 84.7,
      power_draw_watts: 14.2,
      memory_footprint_mb: 480,
      quantization: 'INT8',
    },
  },

  crane_slab_safety: {
    id: 'crane_slab_safety',
    title: '📹 Fixed Tower Crane Cam: Level 1 Suspended Slab Concreting & PPE Safety',
    site_location: 'Commercial Complex Tower B - Grid Bay C2-D4 (Floor Pour Zone)',
    source_type: 'Fixed Crane Camera',
    target_element_tag: '#64',
    target_element_name: 'S-GF-8',
    ifc_class: 'IfcSlab',
    work_stage: 'Ready-Mix Concrete Pumping & Screed Compaction',
    inspection_status: 'SAFETY_VIOLATION',
    confidence_pct: 94.8,
    detections: [
      {
        label: 'Worker Missing Hardhat & Fall Arrest Harness',
        type: 'safety',
        confidence: 0.96,
        bbox: [42, 58, 68, 70],
        severity: 'HIGH',
        detail: 'Operative working within 1.5m of unguarded slab edge without Type-A safety harness and certified hardhat.',
      },
      {
        label: 'Concrete Transit Pump Line Spillage',
        type: 'defect',
        confidence: 0.89,
        bbox: [50, 22, 65, 42],
        severity: 'MEDIUM',
        detail: 'Slump loss spillage observed at boom joint coupling; potential cold joint risk if placement delayed >45 mins.',
      },
      {
        label: 'Compliant Screed Crew (Helmet + High-Vis Vest)',
        type: 'safety',
        confidence: 0.98,
        bbox: [32, 30, 52, 44],
        detail: '3 operatives wearing full Level-3 PPE compliance.',
      },
    ],
    lidar_deviation_mm: 8,
    tolerance_status: 'WITHIN_TOLERANCE',
    vlm_ncr_memo: {
      ncr_number: 'L&T-EHS-NCR-2026-042',
      contractor_subcontractor: 'Metro Concrete Pumping Services',
      clause_reference: 'L&T Corporate EHS Manual Section 14 (Work at Heights) & IS-13416 (Fall Protection)',
      confidence_breakdown: {
        overall_pct: 94.8,
        sensor_grounding: 'Hikvision 4K PTZ Crane-Mounted Optical Stream (30x Optical Zoom)',
        point_cloud_tolerance: '±8.0 mm edge boundary verification',
        bayesian_posterior: 0.965,
      },
      shapley_commercial_attribution: {
        baseline_expected_cost: 185000,
        surges: [
          {
            feature: 'EHS Fall Protection Non-Compliance Penalty',
            impact_inr: 25000,
            impact_pct: 13.5,
            direction: 'increase',
            plain_explanation: 'Direct safety violation penalty for work on unguarded slab perimeter without fall arrest harness.',
          },
          {
            feature: 'Transit Boom Slurry Leakage & Cleaning',
            impact_inr: 12000,
            impact_pct: 6.5,
            direction: 'increase',
            plain_explanation: 'Slurry cleanout and cold-joint prevention screed preparation costs.',
          },
        ],
        final_billed_risk: 222000,
      },
      visual_finding:
        'Fixed tower crane video stream detected worker active on perimeter cantilever slab edge without tethered harness. Joint slurry leakage observed on boom line 3.',
      bim_variance_finding:
        'Slab S-GF-8 edge safety barrier not modeled in 4D construction sequencing schedule for week 42.',
      corrective_action:
        'Halt boom pumping on perimeter zone until edge guardrails and horizontal lifelines are erected. Issue safety notice to contractor foreman.',
      financial_retention_inr: 25000,
    },
    edge_profiler: {
      target_hardware: 'NVIDIA Jetson AGX Orin (64GB)',
      runtime: 'TensorRT 10.3 / GStreamer RTSP',
      latency_ms: 8.4,
      throughput_fps: 119.0,
      power_draw_watts: 28.5,
      memory_footprint_mb: 840,
      quantization: 'FP16',
    },
  },

  robot_pile_honeycombing: {
    id: 'robot_pile_honeycombing',
    title: '🤖 Quadruped Robot SLAM: Foundation Isolated Footing #16 Void Audit',
    site_location: 'Commercial Complex Substructure - Basement Trench Excavation',
    source_type: 'Quadruped Robot (SLAM)',
    target_element_tag: '#16',
    target_element_name: 'F-16',
    ifc_class: 'IfcFooting',
    work_stage: 'Post-Stripping Concrete Quality & Void Inspection',
    inspection_status: 'DEFECT_DETECTED',
    confidence_pct: 98.2,
    detections: [
      {
        label: 'Severe Concrete Honeycombing & Voids (>60 mm depth)',
        type: 'defect',
        confidence: 0.98,
        bbox: [38, 35, 68, 62],
        severity: 'HIGH',
        detail: 'Coarse aggregate segregation and void pocket exposing secondary rebar along north pedestal face.',
      },
      {
        label: 'Over-excavation Footing Boundary (5.2x4.5m vs 2x2m)',
        type: 'structure',
        confidence: 0.95,
        bbox: [15, 10, 85, 90],
        severity: 'HIGH',
        detail: 'Measured footprint area 23.4 m² vs 4.0 m² design standard.',
      },
      {
        label: 'Exposed Rebar Corrosion Hazard',
        type: 'rebar',
        confidence: 0.92,
        bbox: [48, 42, 60, 55],
        severity: 'HIGH',
        detail: 'Un-encapsulated steel exposed to groundwater moisture in excavation pit.',
      },
    ],
    lidar_deviation_mm: 320,
    tolerance_status: 'OUT_OF_TOLERANCE',
    vlm_ncr_memo: {
      ncr_number: 'L&T-QAQC-NCR-2026-FTG-009',
      contractor_subcontractor: 'Geotech Foundations & Infrastructure LLP',
      clause_reference: 'CPWD Spec 5.4.3 (Surface Defects in Concrete) & IS-456 Clause 10.2 (Compaction)',
      confidence_breakdown: {
        overall_pct: 98.2,
        sensor_grounding: 'Unitree B2 Quadruped Robot / Ouster OS1-32 LiDAR + Dual RealSense D435i',
        point_cloud_tolerance: '±2.4 mm surface mesh reconstruction',
        bayesian_posterior: 0.991,
      },
      shapley_commercial_attribution: {
        baseline_expected_cost: 35000,
        surges: [
          {
            feature: 'Mass Concrete Over-Excavation Volumetric Surge',
            impact_inr: 210000,
            impact_pct: 600.0,
            direction: 'increase',
            plain_explanation: 'Footing footprint measured 23.4 m² vs 4.0 m² design norm (28.5 m³ vs 4.1 m³ concrete volume).',
          },
          {
            feature: 'Severe Aggregate Honeycombing (>60 mm void depth)',
            impact_inr: 45000,
            impact_pct: 128.6,
            direction: 'increase',
            plain_explanation: 'Mandatory non-destructive UPV testing, chipped void breakout, and epoxy pressure injection.',
          },
          {
            feature: 'Corrosion Passivation Treatment for Exposed Rebar',
            impact_inr: 15000,
            impact_pct: 42.9,
            direction: 'increase',
            plain_explanation: 'Application of zinc-rich anti-corrosive primer to exposed rebar cage in basement groundwater zone.',
          },
        ],
        final_billed_risk: 305000,
      },
      visual_finding:
        'Quadruped robotic autonomous visual scan detected major aggregate honeycombing with 65 mm void depth and visible rebar cage exposure. Inadequate needle vibration during mass pour.',
      bim_variance_finding:
        'Footing #16 volume 28.5 m³ vs peer cohort mean 4.1 m³ (7x variance). Contractor billed ₹2,45,000 for defective, oversized mass concrete.',
      corrective_action:
        'Perform non-destructive Ultrasonic Pulse Velocity (UPV) test on footing core. Chip out defective honeycombed concrete and pressure-grout with non-shrink high-strength epoxy mortar (M40 grade equivalent). Withhold ₹2,10,000 billing variance.',
      financial_retention_inr: 210000,
    },
    edge_profiler: {
      target_hardware: 'NVIDIA Jetson Orin NX (16GB - Robot Embedded)',
      runtime: 'Isaac ROS 3.1 / TensorRT / OpenVSLAM',
      latency_ms: 14.6,
      throughput_fps: 68.5,
      power_draw_watts: 18.0,
      memory_footprint_mb: 620,
      quantization: 'INT8',
    },
  },

  lidar_viaduct_alignment: {
    id: 'lidar_viaduct_alignment',
    title: '⚡ 3D LiDAR & Digital Twin: Viaduct Pier Verticality & Box Girder Seating',
    site_location: 'Metro Viaduct Alignment - Pier P-11 & Segment Span 4',
    source_type: '3D LiDAR Scanner',
    target_element_tag: '#M_PIER_11',
    target_element_name: 'Pier-Shaft-P11',
    ifc_class: 'IfcColumn',
    work_stage: 'Bearing Pedestal Casting & Precast Girder Launching Prep',
    inspection_status: 'COMPLIANT',
    confidence_pct: 99.1,
    detections: [
      {
        label: 'Pier Plumb & Verticality (1:850 within 1:500 limit)',
        type: 'structure',
        confidence: 0.99,
        bbox: [10, 35, 85, 65],
        detail: 'LiDAR point cloud ICP registration against IFC model shows 4.2 mm deviation across 8.5m height.',
      },
      {
        label: 'Elastomeric Bearing Pedestal Elevation (+2 mm)',
        type: 'structure',
        confidence: 0.97,
        bbox: [12, 38, 25, 62],
        detail: 'Pedestal level verified for precast segmental box girder seating.',
      },
    ],
    lidar_deviation_mm: 4.2,
    tolerance_status: 'WITHIN_TOLERANCE',
    vlm_ncr_memo: {
      ncr_number: 'L&T-METRO-QA-2026-P11',
      contractor_subcontractor: 'L&T Heavy Civil Metro Special Business Unit',
      clause_reference: 'IRC:112 Code of Practice for Concrete Road Bridges & Metro Civil Specs Section 8.4',
      confidence_breakdown: {
        overall_pct: 99.1,
        sensor_grounding: 'Faro Focus Premium 3D Terrestrial LiDAR (0.1 mm precision)',
        point_cloud_tolerance: '±1.8 mm global georeferenced coordinate residual',
        bayesian_posterior: 0.998,
      },
      shapley_commercial_attribution: {
        baseline_expected_cost: 450000,
        surges: [
          {
            feature: 'Pier Verticality Plumb Check (1:850)',
            impact_inr: 0,
            impact_pct: 0,
            direction: 'increase',
            plain_explanation: 'Within 1:500 allowable tilt tolerance per IRC:112 specifications.',
          },
          {
            feature: 'Bearing Seat Pedestal Elevation (+2 mm)',
            impact_inr: 0,
            impact_pct: 0,
            direction: 'increase',
            plain_explanation: 'Pedestal elevation conforms to ±5 mm bearing tolerance.',
          },
        ],
        final_billed_risk: 450000,
      },
      visual_finding:
        'LiDAR 3D point cloud surface reconstruction confirms Pier P-11 verticality and pedestal orientation conform to strict millimeter transit alignment specifications.',
      bim_variance_finding:
        'Physical coordinate centroid matches IFC digital twin within 4.2 mm tolerance (<10 mm permissible limit).',
      corrective_action:
        'Issue structural clearance certificate for precast box girder launching on Span 4.',
      financial_retention_inr: 0,
    },
    edge_profiler: {
      target_hardware: 'NVIDIA RTX 4090 / Omniverse Isaac Sim Station',
      runtime: 'NVIDIA Omniverse USD / CloudXR 4.0 / Open3D',
      latency_ms: 18.2,
      throughput_fps: 54.9,
      power_draw_watts: 95.0,
      memory_footprint_mb: 2400,
      quantization: 'FP16',
    },
  },
};
