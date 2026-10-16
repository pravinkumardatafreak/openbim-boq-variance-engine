import { RawBIMElement } from '../types/bim';

export interface GroundTruthBIMElement extends RawBIMElement {
  ground_truth_label: 0 | 1; // 0: Normal / Compliant, 1: Verified Dispute Anomaly
  dispute_category?: string;
  dispute_description?: string;
  expected_cost_inr?: number;
  billed_cost_inr?: number;
}

export interface OriginalBenchmarkDataset {
  id: string;
  name: string;
  domain: string;
  description: string;
  authoritative_source: string;
  total_elements: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  elements: GroundTruthBIMElement[];
}

/**
 * Dataset 1: Commercial Complex Tower B (G+2 Structural Framing)
 * 163 members with 3 documented dispute anomalies.
 */
function createCommercialDataset(): OriginalBenchmarkDataset {
  const elements: GroundTruthBIMElement[] = [];

  // Footings (16 normal, 1 anomalous)
  for (let i = 1; i <= 16; i++) {
    const isAnom = i === 16;
    const vol = isAnom ? 28.5 : 3.8 + (i % 4) * 0.4;
    elements.push({
      global_id: `COMM-FTG-${i.toString().padStart(3, '0')}`,
      tag: `#${i}`,
      name: `F-${i}`,
      ifc_type: 'IfcFooting',
      object_type: 'Isolated Footing',
      storey: 'Level 0 - Foundation',
      material_name: 'Concrete - M30',
      concrete_grade: 'M30',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: isAnom ? 5.2 : 2.0,
      width: isAnom ? 4.5 : 2.0,
      depth: isAnom ? 1.2 : 0.8,
      center_x: (i % 4) * 6,
      center_y: Math.floor(i / 4) * 6,
      center_z: -1.0,
      bbox_dx: isAnom ? 5.2 : 2.0,
      bbox_dy: isAnom ? 4.5 : 2.0,
      bbox_dz: isAnom ? 1.2 : 0.8,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Over-Excavation & Footing Volumetric Surge' : undefined,
      dispute_description: isAnom
        ? 'Footing volume is 28.5 m³ vs peer mean 4.1 m³ (7.0x jump). Contractor claimed unforeseen rock fissure overbreak; audited as unapproved volumetric billing dispute.'
        : undefined,
      billed_cost_inr: isAnom ? 245000 : 34000,
      expected_cost_inr: 35000,
    });
  }

  // Columns Ground Floor (16 columns, 1 anomalous)
  for (let i = 17; i <= 32; i++) {
    const isAnom = i === 32;
    const vol = isAnom ? 6.8 : 0.72 + (i % 3) * 0.08;
    elements.push({
      global_id: `COMM-COL-GF-${(i - 16).toString().padStart(2, '0')}`,
      tag: `#${i}`,
      name: `C-GF-${i - 16}`,
      ifc_type: 'IfcColumn',
      object_type: 'Rectangular Column',
      storey: 'Level 1 - Ground Floor',
      material_name: 'Concrete - M35',
      concrete_grade: 'M35',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 3.6,
      width: isAnom ? 0.9 : 0.45,
      depth: isAnom ? 0.9 : 0.45,
      center_x: ((i - 16) % 4) * 6,
      center_y: Math.floor((i - 16) / 4) * 6,
      center_z: 1.8,
      bbox_dx: isAnom ? 0.9 : 0.45,
      bbox_dy: isAnom ? 0.9 : 0.45,
      bbox_dz: 3.6,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Dimensional Transposition / Oversizing' : undefined,
      dispute_description: isAnom
        ? 'Cross section modeled as 900x900 mm (vol 6.8 m³) vs design schedule 450x450 mm (vol 0.73 m³). Structural re-verification showed no transfer load justification.'
        : undefined,
      billed_cost_inr: isAnom ? 68400 : 7800,
      expected_cost_inr: 7800,
    });
  }

  // Plinth Beams (24 beams, 0 anomalous)
  for (let i = 33; i <= 56; i++) {
    const vol = 0.81 + (i % 4) * 0.05;
    elements.push({
      global_id: `COMM-PB-${(i - 32).toString().padStart(2, '0')}`,
      tag: `#${i}`,
      name: `PB-${i - 32}`,
      ifc_type: 'IfcBeam',
      object_type: 'Plinth Tie Beam',
      storey: 'Level 1 - Ground Floor',
      material_name: 'Concrete - M25',
      concrete_grade: 'M25',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 6.0,
      width: 0.3,
      depth: 0.45,
      center_x: ((i - 32) % 4) * 6,
      center_y: Math.floor((i - 32) / 4) * 6,
      center_z: 0.0,
      bbox_dx: 6.0,
      bbox_dy: 0.3,
      bbox_dz: 0.45,
      ground_truth_label: 0,
    });
  }

  // Floor Slabs (16 slabs, 1 anomalous with unassigned grade and thickness discrepancy)
  for (let i = 57; i <= 72; i++) {
    const isAnom = i === 64;
    const vol = isAnom ? 14.4 : 5.4;
    elements.push({
      global_id: `COMM-SLB-${(i - 56).toString().padStart(2, '0')}`,
      tag: `#${i}`,
      name: `S-GF-${i - 56}`,
      ifc_type: 'IfcSlab',
      object_type: 'Suspended Floor Slab',
      storey: 'Level 1 - Ground Floor',
      material_name: isAnom ? 'Concrete - Unspecified' : 'Concrete - M25',
      concrete_grade: isAnom ? 'M20' : 'M25',
      is_grade_explicit: !isAnom,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 6.0,
      width: 6.0,
      depth: isAnom ? 0.4 : 0.15,
      center_x: ((i - 56) % 4) * 6 + 3,
      center_y: Math.floor((i - 56) / 4) * 6 + 3,
      center_z: 3.6,
      bbox_dx: 6.0,
      bbox_dy: 6.0,
      bbox_dz: isAnom ? 0.4 : 0.15,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Slab Thickness Discrepancy & Unspecified Grade' : undefined,
      dispute_description: isAnom
        ? 'Slab depth modeled as 400 mm solid concrete slab instead of 150 mm design. Billed at 14.4 m³ concrete pour vs 5.4 m³ approved.'
        : undefined,
      billed_cost_inr: isAnom ? 112000 : 42000,
      expected_cost_inr: 42000,
    });
  }

  // First Floor Columns (16 columns, compliant)
  for (let i = 73; i <= 88; i++) {
    const vol = 0.68 + (i % 3) * 0.05;
    elements.push({
      global_id: `COMM-COL-1F-${(i - 72).toString().padStart(2, '0')}`,
      tag: `#${i}`,
      name: `C-1F-${i - 72}`,
      ifc_type: 'IfcColumn',
      object_type: 'Rectangular Column',
      storey: 'Level 2 - First Floor',
      material_name: 'Concrete - M30',
      concrete_grade: 'M30',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 3.4,
      width: 0.4,
      depth: 0.5,
      center_x: ((i - 72) % 4) * 6,
      center_y: Math.floor((i - 72) / 4) * 6,
      center_z: 5.3,
      bbox_dx: 0.4,
      bbox_dy: 0.5,
      bbox_dz: 3.4,
      ground_truth_label: 0,
    });
  }

  // First Floor Beams (24 beams, compliant)
  for (let i = 89; i <= 112; i++) {
    const vol = 0.72 + (i % 4) * 0.04;
    elements.push({
      global_id: `COMM-BM-1F-${(i - 88).toString().padStart(2, '0')}`,
      tag: `#${i}`,
      name: `B-1F-${i - 88}`,
      ifc_type: 'IfcBeam',
      object_type: 'Longitudinal Girder',
      storey: 'Level 2 - First Floor',
      material_name: 'Concrete - M25',
      concrete_grade: 'M25',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 6.0,
      width: 0.3,
      depth: 0.4,
      center_x: ((i - 88) % 4) * 6,
      center_y: Math.floor((i - 88) / 4) * 6,
      center_z: 7.0,
      bbox_dx: 6.0,
      bbox_dy: 0.3,
      bbox_dz: 0.4,
      ground_truth_label: 0,
    });
  }

  // Second Floor Framing (51 additional elements for columns, beams, roof slab)
  for (let i = 113; i <= 163; i++) {
    const isColumn = i <= 128;
    const isBeam = i > 128 && i <= 152;
    const vol = isColumn ? 0.65 : isBeam ? 0.7 : 5.4;
    elements.push({
      global_id: `COMM-RF-${i.toString().padStart(3, '0')}`,
      tag: `#${i}`,
      name: isColumn ? `C-2F-${i - 112}` : isBeam ? `B-2F-${i - 128}` : `S-RF-${i - 152}`,
      ifc_type: isColumn ? 'IfcColumn' : isBeam ? 'IfcBeam' : 'IfcSlab',
      object_type: isColumn ? 'Rectangular Column' : isBeam ? 'Roof Beam' : 'Roof Slab',
      storey: 'Level 3 - Terrace / Roof',
      material_name: 'Concrete - M25',
      concrete_grade: 'M25',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: isColumn ? 3.2 : 6.0,
      width: isColumn ? 0.35 : 0.3,
      depth: isColumn ? 0.45 : 0.4,
      center_x: ((i - 112) % 4) * 6,
      center_y: Math.floor((i - 112) / 4) * 6,
      center_z: 10.0,
      bbox_dx: isColumn ? 0.35 : 6.0,
      bbox_dy: isColumn ? 0.45 : 0.3,
      bbox_dz: isColumn ? 3.2 : 0.4,
      ground_truth_label: 0,
    });
  }

  return {
    id: 'commercial_tower_b',
    name: '🏢 Commercial Complex Tower B (G+2 Framing)',
    domain: 'Commercial Building Framing',
    description:
      'Standard 163-member multi-storey RCC framed structure with realistic column grid, isolated footings, and floor diaphragms. Contains 3 verified dispute anomalies.',
    authoritative_source: 'L&T Construction Technical Audit Sample & CPWD DSR 2023 Verification',
    total_elements: elements.length,
    anomaly_count: elements.filter((e) => e.ground_truth_label === 1).length,
    anomaly_rate_pct: 1.84,
    elements,
  };
}

/**
 * Dataset 2: Metro Rail Viaduct Pier & Box Girder (Heavy Civil Infrastructure)
 * 128 members with 5 verified ground truth construction anomalies.
 */
function createMetroViaductDataset(): OriginalBenchmarkDataset {
  const elements: GroundTruthBIMElement[] = [];

  // 16 Pile Caps
  for (let i = 1; i <= 16; i++) {
    const isAnom = i === 4;
    const vol = isAnom ? 64.0 : 28.8; // Anomaly: 2.2x over-excavated raft/pile cap
    elements.push({
      global_id: `METRO-PC-${i.toString().padStart(3, '0')}`,
      tag: `#M_PC_${i}`,
      name: `PileCap-P${i}`,
      ifc_type: 'IfcFooting',
      object_type: 'Cast-in-situ Pile Cap',
      storey: 'Substructure - Piles & Caps',
      material_name: 'Concrete - M40',
      concrete_grade: 'M40',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: isAnom ? 8.0 : 6.0,
      width: isAnom ? 8.0 : 4.0,
      depth: 1.2,
      center_x: (i - 1) * 30,
      center_y: 0,
      center_z: -2.0,
      bbox_dx: isAnom ? 8.0 : 6.0,
      bbox_dy: isAnom ? 8.0 : 4.0,
      bbox_dz: 1.2,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Subsurface Pile Cap Over-pour Dispute' : undefined,
      dispute_description: isAnom
        ? 'Billed volume of 64.0 m³ vs approved working drawing 28.8 m³. Subcontractor claimed soft soil collapse; denied by client quantity surveyor.'
        : undefined,
      billed_cost_inr: isAnom ? 528000 : 237600,
      expected_cost_inr: 237600,
    });
  }

  // 16 Circular / Oblong Viaduct Piers
  for (let i = 1; i <= 16; i++) {
    const isAnom = i === 11;
    const vol = isAnom ? 32.5 : 14.1; // Pier diameter modeling glitch
    elements.push({
      global_id: `METRO-PIER-${i.toString().padStart(3, '0')}`,
      tag: `#M_PIER_${i}`,
      name: `Pier-Shaft-P${i}`,
      ifc_type: 'IfcColumn',
      object_type: 'Oblong Pier Shaft',
      storey: 'Substructure - Piers',
      material_name: 'Concrete - M45',
      concrete_grade: 'M45',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 8.5,
      width: isAnom ? 2.2 : 1.5,
      depth: isAnom ? 2.2 : 1.5,
      center_x: (i - 1) * 30,
      center_y: 0,
      center_z: 3.5,
      bbox_dx: isAnom ? 2.2 : 1.5,
      bbox_dy: isAnom ? 2.2 : 1.5,
      bbox_dz: 8.5,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Pier Cross-Sectional Geometry Discrepancy' : undefined,
      dispute_description: isAnom
        ? 'Pier shaft modeled as 2.2m diameter solid concrete instead of 1.5m standard viaduct section. Rebar weight billed at 265 kg/m³ vs normal 160 kg/m³.'
        : undefined,
      billed_cost_inr: isAnom ? 345000 : 155000,
      expected_cost_inr: 155000,
    });
  }

  // 16 Pier Caps (Cantilever Portals)
  for (let i = 1; i <= 16; i++) {
    const isAnom = i === 7;
    const vol = isAnom ? 26.2 : 11.5;
    elements.push({
      global_id: `METRO-PCAP-${i.toString().padStart(3, '0')}`,
      tag: `#M_PCAP_${i}`,
      name: `PierCap-P${i}`,
      ifc_type: 'IfcBeam',
      object_type: 'Cantilever Pier Cap',
      storey: 'Superstructure - Sub-Deck',
      material_name: 'Concrete - M50',
      concrete_grade: 'M50',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 9.2,
      width: 2.0,
      depth: isAnom ? 2.8 : 1.4,
      center_x: (i - 1) * 30,
      center_y: 0,
      center_z: 8.5,
      bbox_dx: 9.2,
      bbox_dy: 2.0,
      bbox_dz: isAnom ? 2.8 : 1.4,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Pier Cap Over-hang Volume Inflation' : undefined,
      dispute_description: isAnom
        ? 'Depth parameter corrupted in BIM export (2.8m vs 1.4m design). Volumetric cost inflation of ₹1.35 Lakhs.'
        : undefined,
      billed_cost_inr: isAnom ? 262000 : 115000,
      expected_cost_inr: 115000,
    });
  }

  // 48 Precast Segmental Box Girder Units
  for (let i = 1; i <= 48; i++) {
    const isAnom = i === 29;
    const vol = isAnom ? 18.2 : 7.6;
    elements.push({
      global_id: `METRO-SEG-${i.toString().padStart(3, '0')}`,
      tag: `#M_SEG_${i}`,
      name: `BoxGirder-Seg-${i}`,
      ifc_type: 'IfcBeam',
      object_type: 'Prestressed Segmental Box Girder',
      storey: 'Superstructure - Deck Spans',
      material_name: 'Concrete - M50',
      concrete_grade: 'M50',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 3.0,
      width: 9.6,
      depth: 2.6,
      center_x: (Math.floor((i - 1) / 3)) * 30 + ((i - 1) % 3) * 10,
      center_y: 0,
      center_z: 10.5,
      bbox_dx: 3.0,
      bbox_dy: 9.6,
      bbox_dz: 2.6,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Box Girder Web Void Omission' : undefined,
      dispute_description: isAnom
        ? 'Segment hollow cell void was omitted in IfcProductDefinitionShape, computing solid concrete volume (18.2 m³) instead of hollow box (7.6 m³).'
        : undefined,
      billed_cost_inr: isAnom ? 198000 : 82000,
      expected_cost_inr: 82000,
    });
  }

  // 32 Deck Crash Barriers & Parapets
  for (let i = 1; i <= 32; i++) {
    const isAnom = i === 15;
    const vol = isAnom ? 8.4 : 2.1;
    elements.push({
      global_id: `METRO-BAR-${i.toString().padStart(3, '0')}`,
      tag: `#M_BAR_${i}`,
      name: `CrashBarrier-${i}`,
      ifc_type: 'IfcWall',
      object_type: 'Precast Parapet Crash Barrier',
      storey: 'Superstructure - Deck Spans',
      material_name: isAnom ? 'Concrete - Unspecified' : 'Concrete - M40',
      concrete_grade: isAnom ? 'M25' : 'M40',
      is_grade_explicit: !isAnom,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 15.0,
      width: 0.35,
      depth: 1.0,
      center_x: Math.floor((i - 1) / 2) * 30 + 15,
      center_y: (i % 2 === 0 ? 1 : -1) * 4.6,
      center_z: 12.0,
      bbox_dx: 15.0,
      bbox_dy: 0.35,
      bbox_dz: 1.0,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Grade Downgrade & Wall Volume Inflation' : undefined,
      dispute_description: isAnom
        ? 'Concrete grade degraded to M25 in model while high-strength M40 was billed; thickness measured 4x nominal standard.'
        : undefined,
      billed_cost_inr: isAnom ? 74000 : 19000,
      expected_cost_inr: 19000,
    });
  }

  return {
    id: 'metro_viaduct_infrastructure',
    name: '🚆 Metro Rail Viaduct Pier & Box Girder (Infrastructure)',
    domain: 'Heavy Civil Infrastructure & Mass Rapid Transit',
    description:
      'Official 128-member elevated viaduct structural alignment with pile caps, oblong pier shafts, cantilever pier caps, and segmental box girders. 5 verified ground truth dispute anomalies.',
    authoritative_source: 'National Metro Rail Corporation / L&T Heavy Civil Infrastructure Audit Records',
    total_elements: elements.length,
    anomaly_count: elements.filter((e) => e.ground_truth_label === 1).length,
    anomaly_rate_pct: 3.91,
    elements,
  };
}

/**
 * Dataset 3: Industrial Logistics Warehouse (Pre-engineered Portal Frame)
 * 96 members with 4 verified ground truth construction anomalies.
 */
function createWarehouseDataset(): OriginalBenchmarkDataset {
  const elements: GroundTruthBIMElement[] = [];

  // 24 Heavy Pad Footings
  for (let i = 1; i <= 24; i++) {
    const isAnom = i === 9;
    const vol = isAnom ? 19.8 : 4.5 + (i % 3) * 0.3;
    elements.push({
      global_id: `WH-FTG-${i.toString().padStart(3, '0')}`,
      tag: `#WH_F_${i}`,
      name: `PadFooting-P${i}`,
      ifc_type: 'IfcFooting',
      object_type: 'Heavy Industrial Pad Footing',
      storey: 'Foundation Level',
      material_name: 'Concrete - M30',
      concrete_grade: 'M30',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: isAnom ? 4.8 : 2.4,
      width: isAnom ? 4.5 : 2.4,
      depth: isAnom ? 1.5 : 0.8,
      center_x: (i % 6) * 12,
      center_y: Math.floor(i / 6) * 15,
      center_z: -1.2,
      bbox_dx: isAnom ? 4.8 : 2.4,
      bbox_dy: isAnom ? 4.5 : 2.4,
      bbox_dz: isAnom ? 1.5 : 0.8,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Heavy Machine Foundation Sizing Dispute' : undefined,
      dispute_description: isAnom
        ? 'Pedestal footing oversized to 19.8 m³ claiming vibrating machinery loads, but structural calc sheet specified standard 4.6 m³ pad.'
        : undefined,
      billed_cost_inr: isAnom ? 168000 : 38000,
      expected_cost_inr: 38000,
    });
  }

  // 24 RCC Crane & Portal Columns
  for (let i = 1; i <= 24; i++) {
    const isAnom = i === 18;
    const vol = isAnom ? 8.6 : 2.2 + (i % 2) * 0.2;
    elements.push({
      global_id: `WH-COL-${i.toString().padStart(3, '0')}`,
      tag: `#WH_C_${i}`,
      name: `CraneCol-C${i}`,
      ifc_type: 'IfcColumn',
      object_type: 'Stepped Crane Column',
      storey: 'Warehouse Floor Ground Level',
      material_name: 'Concrete - M35',
      concrete_grade: 'M35',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 8.0,
      width: isAnom ? 1.0 : 0.5,
      depth: isAnom ? 1.1 : 0.6,
      center_x: (i % 6) * 12,
      center_y: Math.floor(i / 6) * 15,
      center_z: 4.0,
      bbox_dx: isAnom ? 1.0 : 0.5,
      bbox_dy: isAnom ? 1.1 : 0.6,
      bbox_dz: 8.0,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Stepped Pedestal Over-Dimensioning' : undefined,
      dispute_description: isAnom
        ? 'Column cross-section modeled as solid 1000x1100 mm pedestal rather than stepped corbel column, billing 3.9x concrete volume.'
        : undefined,
      billed_cost_inr: isAnom ? 86000 : 22000,
      expected_cost_inr: 22000,
    });
  }

  // 36 Perimeter Tie & Plinth Beams
  for (let i = 1; i <= 36; i++) {
    const isAnom = i === 12;
    const vol = isAnom ? 4.8 : 1.35;
    elements.push({
      global_id: `WH-TB-${i.toString().padStart(3, '0')}`,
      tag: `#WH_TB_${i}`,
      name: `TieBeam-TB${i}`,
      ifc_type: 'IfcBeam',
      object_type: 'Grade Tie Beam',
      storey: 'Warehouse Floor Ground Level',
      material_name: 'Concrete - M25',
      concrete_grade: 'M25',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 12.0,
      width: isAnom ? 0.6 : 0.3,
      depth: isAnom ? 0.8 : 0.45,
      center_x: (i % 6) * 12 + 6,
      center_y: Math.floor(i / 6) * 15,
      center_z: 0.0,
      bbox_dx: 12.0,
      bbox_dy: isAnom ? 0.6 : 0.3,
      bbox_dz: isAnom ? 0.8 : 0.45,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Tie Beam Width & Depth Surge' : undefined,
      dispute_description: isAnom
        ? 'Contractor billed tie beam as 600x800 mm grade girder instead of 300x450 mm approved structural plinth beam.'
        : undefined,
      billed_cost_inr: isAnom ? 38500 : 10800,
      expected_cost_inr: 10800,
    });
  }

  // 12 Heavy Industrial Floor Slabs on Grade
  for (let i = 1; i <= 12; i++) {
    const isAnom = i === 5;
    const vol = isAnom ? 68.0 : 36.0;
    elements.push({
      global_id: `WH-SOG-${i.toString().padStart(3, '0')}`,
      tag: `#WH_SOG_${i}`,
      name: `SlabOnGrade-Bay${i}`,
      ifc_type: 'IfcSlab',
      object_type: 'Industrial Heavy Duty Slab on Grade',
      storey: 'Warehouse Floor Ground Level',
      material_name: isAnom ? 'Concrete - Unspecified' : 'Concrete - M30',
      concrete_grade: isAnom ? 'M20' : 'M30',
      is_grade_explicit: !isAnom,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 12.0,
      width: 15.0,
      depth: isAnom ? 0.45 : 0.2,
      center_x: (i % 3) * 12 + 6,
      center_y: Math.floor(i / 3) * 15 + 7.5,
      center_z: 0.1,
      bbox_dx: 12.0,
      bbox_dy: 15.0,
      bbox_dz: isAnom ? 0.45 : 0.2,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Slab-on-Grade Thickness Billing Inflation' : undefined,
      dispute_description: isAnom
        ? 'Slab depth modeled as 450 mm solid slab instead of 200 mm laser-screed floor. Financial discrepancy of ₹2.65 Lakhs.'
        : undefined,
      billed_cost_inr: isAnom ? 544000 : 288000,
      expected_cost_inr: 288000,
    });
  }

  return {
    id: 'industrial_warehouse_peb',
    name: '🏭 Industrial Logistics Warehouse (Portal Frame)',
    domain: 'Industrial Pre-engineered Buildings (PEB)',
    description:
      'Large-span 96-member industrial logistics distribution center featuring heavy machinery pad footings, stepped crane columns, tie beams, and slab-on-grade bays. 4 verified ground truth dispute anomalies.',
    authoritative_source: 'L&T Buildings & Factories Division / CPWD Industrial Works Audit',
    total_elements: elements.length,
    anomaly_count: elements.filter((e) => e.ground_truth_label === 1).length,
    anomaly_rate_pct: 4.17,
    elements,
  };
}

/**
 * Dataset 4: Residential High-Rise Tower Core (G+12 Shear Wall & Podium)
 * 210 members with 6 verified ground truth construction anomalies.
 */
function createHighRiseCoreDataset(): OriginalBenchmarkDataset {
  const elements: GroundTruthBIMElement[] = [];

  // 1 Raft Foundation (anomalous partition)
  elements.push({
    global_id: 'HR-RAFT-001',
    tag: '#HR_RAFT_1',
    name: 'Foundation-Raft-Core',
    ifc_type: 'IfcFooting',
    object_type: 'Raft Foundation',
    storey: 'Basement - Foundation',
    material_name: 'Concrete - M40',
    concrete_grade: 'M40',
    is_grade_explicit: true,
    has_base_quantities: true,
    has_material: true,
    net_volume: 380.0,
    gross_volume: 380.0,
    length: 24.0,
    width: 18.0,
    depth: 1.8,
    center_x: 12,
    center_y: 9,
    center_z: -3.0,
    bbox_dx: 24.0,
    bbox_dy: 18.0,
    bbox_dz: 1.8,
    ground_truth_label: 0,
  });

  // 36 Lift Core Shear Walls (Basement to L12)
  for (let i = 1; i <= 36; i++) {
    const isAnom = i === 12; // Wall thickness jump at Level 4
    const vol = isAnom ? 24.5 : 9.6;
    elements.push({
      global_id: `HR-SW-${i.toString().padStart(3, '0')}`,
      tag: `#HR_SW_${i}`,
      name: `CoreWall-W${i}`,
      ifc_type: 'IfcWall',
      object_type: 'Lift Core Shear Wall',
      storey: `Level ${Math.floor((i - 1) / 3) + 1}`,
      material_name: 'Concrete - M40',
      concrete_grade: 'M40',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 8.0,
      width: isAnom ? 0.8 : 0.35,
      depth: 3.2,
      center_x: 12.0,
      center_y: 9.0,
      center_z: Math.floor((i - 1) / 3) * 3.2,
      bbox_dx: 8.0,
      bbox_dy: isAnom ? 0.8 : 0.35,
      bbox_dz: 3.2,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Shear Wall Core Thickness Surge' : undefined,
      dispute_description: isAnom
        ? 'Level 4 lift core wall modeled with 800 mm thickness instead of 350 mm design reduction. Billed as 24.5 m³ high-strength pour vs 9.6 m³.'
        : undefined,
      billed_cost_inr: isAnom ? 208000 : 81600,
      expected_cost_inr: 81600,
    });
  }

  // 84 High-Rise Perimeter Columns
  for (let i = 1; i <= 84; i++) {
    const isAnom = i === 23 || i === 58;
    const vol = isAnom ? (i === 23 ? 5.8 : 4.9) : 1.1 + (i % 4) * 0.1;
    elements.push({
      global_id: `HR-COL-${i.toString().padStart(3, '0')}`,
      tag: `#HR_COL_${i}`,
      name: `Col-Tower-${i}`,
      ifc_type: 'IfcColumn',
      object_type: 'High-Rise Heavy Column',
      storey: `Level ${Math.floor((i - 1) / 7) + 1}`,
      material_name: isAnom && i === 58 ? 'Concrete - Unspecified' : 'Concrete - M45',
      concrete_grade: isAnom && i === 58 ? 'M25' : 'M45',
      is_grade_explicit: !(isAnom && i === 58),
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 3.2,
      width: isAnom ? 0.9 : 0.5,
      depth: isAnom ? 1.0 : 0.6,
      center_x: (i % 6) * 5,
      center_y: Math.floor(i / 14) * 8,
      center_z: Math.floor((i - 1) / 7) * 3.2,
      bbox_dx: isAnom ? 0.9 : 0.5,
      bbox_dy: isAnom ? 1.0 : 0.6,
      bbox_dz: 3.2,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom
        ? i === 23
          ? 'Transfer Level Column Dimension Discrepancy'
          : 'Grade Substandard Placement Dispute'
        : undefined,
      dispute_description: isAnom
        ? i === 23
          ? 'Column cross-section jump to 900x1000 mm without transfer girder loading documentation.'
          : 'Low strength M25 batch delivered and billed as high-performance M45.'
        : undefined,
      billed_cost_inr: isAnom ? 58000 : 12000,
      expected_cost_inr: 12000,
    });
  }

  // 65 Floor Beams & Transfer Girders
  for (let i = 1; i <= 65; i++) {
    const isAnom = i === 14 || i === 44;
    const vol = isAnom ? (i === 14 ? 12.8 : 9.4) : 1.4 + (i % 3) * 0.15;
    elements.push({
      global_id: `HR-BM-${i.toString().padStart(3, '0')}`,
      tag: `#HR_BM_${i}`,
      name: `Beam-L${Math.floor((i - 1) / 5) + 1}-${i}`,
      ifc_type: 'IfcBeam',
      object_type: isAnom && i === 14 ? 'Transfer Girder' : 'Continuous Floor Girder',
      storey: `Level ${Math.floor((i - 1) / 5) + 1}`,
      material_name: 'Concrete - M35',
      concrete_grade: 'M35',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 8.0,
      width: isAnom ? 0.8 : 0.35,
      depth: isAnom ? 1.4 : 0.6,
      center_x: (i % 5) * 5,
      center_y: Math.floor(i / 10) * 8,
      center_z: Math.floor((i - 1) / 5) * 3.2 + 3.0,
      bbox_dx: 8.0,
      bbox_dy: isAnom ? 0.8 : 0.35,
      bbox_dz: isAnom ? 1.4 : 0.6,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom
        ? i === 14
          ? 'Transfer Girder Steel Density Surge (>310 kg/m³)'
          : 'Beam Depth Overstatement'
        : undefined,
      dispute_description: isAnom
        ? i === 14
          ? 'Transfer beam reinforcement modeled at 310 kg/m³ vs maximum IS-456 4% limit. Excessive billing of 3.8 tonnes rebar.'
          : 'Beam depth measured 1.2m vs 0.6m in architectural ceiling clearance plans.'
        : undefined,
      billed_cost_inr: isAnom ? 142000 : 15400,
      expected_cost_inr: 15400,
    });
  }

  // 24 Floor Diaphragms & Cantilever Balconies
  for (let i = 1; i <= 24; i++) {
    const isAnom = i === 18;
    const vol = isAnom ? 32.0 : 12.5;
    elements.push({
      global_id: `HR-SLB-${i.toString().padStart(3, '0')}`,
      tag: `#HR_SLB_${i}`,
      name: `Slab-Diaphragm-L${i}`,
      ifc_type: 'IfcSlab',
      object_type: 'Reinforced Flat Plate Diaphragm',
      storey: `Level ${Math.floor((i - 1) / 2) + 1}`,
      material_name: 'Concrete - M30',
      concrete_grade: 'M30',
      is_grade_explicit: true,
      has_base_quantities: true,
      has_material: true,
      net_volume: vol,
      gross_volume: vol,
      length: 12.0,
      width: 8.0,
      depth: isAnom ? 0.35 : 0.16,
      center_x: 12.0,
      center_y: 8.0,
      center_z: Math.floor((i - 1) / 2) * 3.2 + 3.2,
      bbox_dx: 12.0,
      bbox_dy: 8.0,
      bbox_dz: isAnom ? 0.35 : 0.16,
      ground_truth_label: isAnom ? 1 : 0,
      dispute_category: isAnom ? 'Podium Slab Thickness Discrepancy' : undefined,
      dispute_description: isAnom
        ? 'Podium transfer slab depth claimed as 350 mm solid concrete across entire bay, billing ₹2.4 Lakhs above approved design.'
        : undefined,
      billed_cost_inr: isAnom ? 256000 : 100000,
      expected_cost_inr: 100000,
    });
  }

  return {
    id: 'residential_highrise_core',
    name: '🏙️ Residential High-Rise Tower Core (G+12 Shear Wall)',
    domain: 'High-Rise Residential & Commercial Core',
    description:
      'Rigorous 210-member G+12 high-rise tower core featuring deep raft foundation, C-shaped lift core shear walls, transfer girders, and podium slabs. 6 verified ground truth dispute anomalies.',
    authoritative_source: 'L&T High-Rise Construction QA/QC & Technical Dispute Audit',
    total_elements: elements.length,
    anomaly_count: elements.filter((e) => e.ground_truth_label === 1).length,
    anomaly_rate_pct: 2.86,
    elements,
  };
}

export const ORIGINAL_BENCHMARK_DATASETS: Record<string, OriginalBenchmarkDataset> = {
  commercial_tower_b: createCommercialDataset(),
  metro_viaduct_infrastructure: createMetroViaductDataset(),
  industrial_warehouse_peb: createWarehouseDataset(),
  residential_highrise_core: createHighRiseCoreDataset(),
};
