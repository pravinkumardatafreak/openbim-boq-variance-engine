import { ModelMetadata, RawBIMElement } from '../types/bim';
import sampleTowerData from '../data/sample_tower.json';

const STRUCTURAL_IFC_CLASSES = new Set([
  'IFCFOOTING',
  'IFCPILE',
  'IFCCOLUMN',
  'IFCBEAM',
  'IFCMEMBER',
  'IFCSLAB',
  'IFCWALL',
  'IFCWALLSTANDARDCASE',
  'IFCPLATE',
  'IFCROOF',
  'IFCSTAIRFLIGHT',
]);

const CONCRETE_GRADE_REGEX = /\b(M\s*15|M\s*20|M\s*25|M\s*30|M\s*35|M\s*40|M\s*50|M\s*60)\b/i;

/** IFC Name attribute is the second quoted string (first is GlobalId). */
function ifcDisplayName(params: string, fallback: string): string {
  const quoted = Array.from(params.matchAll(/'([^']*)'/g)).map((m) => m[1]);
  if (quoted.length >= 2 && quoted[1].trim()) return quoted[1];
  if (quoted.length >= 1 && quoted[0].trim()) return quoted[0];
  return fallback;
}

export function loadSampleModel(): { metadata: ModelMetadata; elements: RawBIMElement[] } {
  const data = sampleTowerData as {
    metadata: ModelMetadata;
    elements: (RawBIMElement & { bbox_x?: number; bbox_y?: number; bbox_z?: number })[];
  };
  return {
    metadata: data.metadata,
    // The bundled dataset stores element centroids as bbox_x/y/z; the viewer expects center_x/y/z.
    elements: data.elements.map(({ bbox_x, bbox_y, bbox_z, ...el }) => ({
      ...el,
      center_x: el.center_x ?? bbox_x ?? 0,
      center_y: el.center_y ?? bbox_y ?? 0,
      center_z: el.center_z ?? bbox_z ?? 0,
    })),
  };
}

export function parseIFCContent(content: string): { metadata: ModelMetadata; elements: RawBIMElement[] } {
  const lines = content.split('\n');
  const metadata: ModelMetadata = {
    schema: 'IFC4',
    project_name: 'BIM Project',
    site_name: 'Site',
    building_name: 'Building Structure',
    author: '',
    originating_system: 'Uploaded IFC Model',
    total_entities: 0,
  };

  // STEP entity map: id -> { type, params, raw }
  const entityMap = new Map<string, { type: string; params: string; id: string }>();

  // Extract header schema
  const schemaMatch = content.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
  if (schemaMatch) {
    metadata.schema = schemaMatch[1];
  }

  // Parse lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#')) continue;

    metadata.total_entities = (metadata.total_entities || 0) + 1;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const id = line.substring(0, eqIdx).trim(); // e.g. #16
    const rest = line.substring(eqIdx + 1).trim();
    const parenIdx = rest.indexOf('(');
    if (parenIdx === -1) continue;

    const type = rest.substring(0, parenIdx).trim().toUpperCase();
    const params = rest.substring(parenIdx);
    entityMap.set(id, { id, type, params });

    // Look for project / building names (skip GlobalId — use Name attribute)
    if (type === 'IFCPROJECT') {
      metadata.project_name = ifcDisplayName(params, metadata.project_name);
    } else if (type === 'IFCBUILDING') {
      metadata.building_name = ifcDisplayName(params, metadata.building_name);
    } else if (type === 'IFCSITE') {
      metadata.site_name = ifcDisplayName(params, metadata.site_name);
    }
  }

  // Find storeys
  const storeyMap = new Map<string, string>(); // storeyId -> storeyName
  for (const [id, ent] of entityMap.entries()) {
    if (ent.type === 'IFCBUILDINGSTOREY') {
      storeyMap.set(id, ifcDisplayName(ent.params, 'Level'));
    }
  }

  // Containment map: elementId -> storeyName
  const elementStoreyMap = new Map<string, string>();
  for (const [, ent] of entityMap.entries()) {
    if (ent.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
      const trailingStorey = ent.params.match(/,\s*(#[0-9]+)\s*\)\s*;?\s*$/);
      const leadingStorey = ent.params.match(
        /IFCRELCONTAINEDINSPATIALSTRUCTURE\s*\([^,]+,[^,]+,[^,]+,[^,]+,\s*(#[0-9]+)\s*,/i
      );
      const targetStoreyId = trailingStorey?.[1] ?? leadingStorey?.[1] ?? null;
      const storeyName = targetStoreyId ? storeyMap.get(targetStoreyId) || 'Level' : 'Level';

      const listMatch = ent.params.match(/\(\s*(#[0-9]+(?:\s*,\s*#[0-9]+)*)\s*\)\s*,\s*#[0-9]+\s*\)/i)
        ?? ent.params.match(/\(\s*(#[0-9]+(?:\s*,\s*#[0-9]+)*)\s*\)\s*;?\s*$/i);
      if (listMatch) {
        const itemIds = listMatch[1].split(',').map((s) => s.trim());
        for (const itemId of itemIds) {
          elementStoreyMap.set(itemId, storeyName);
        }
      }
    }
  }

  // Material associations: elementId -> materialName
  const elementMaterialMap = new Map<string, string>();
  for (const [, ent] of entityMap.entries()) {
    if (ent.type === 'IFCRELASSOCIATESMATERIAL') {
      const matIdMatch = ent.params.match(/,\s*(#[0-9]+)\s*\);?$/);
      if (matIdMatch) {
        const matEnt = entityMap.get(matIdMatch[1]);
        let matName = 'Concrete';
        if (matEnt) {
          const nm = matEnt.params.match(/'([^']*)'/);
          if (nm) matName = nm[1];
        }
        const itemsMatch = ent.params.match(/\((#[0-9, #]+)\)/);
        if (itemsMatch) {
          const itemIds = itemsMatch[1].split(',').map((s) => s.trim());
          for (const itemId of itemIds) {
            elementMaterialMap.set(itemId, matName);
          }
        }
      }
    }
  }

  // Property & Quantity sets: elementId -> props
  const elementPropsMap = new Map<
    string,
    {
      net_volume?: number;
      gross_volume?: number;
      length?: number;
      width?: number;
      depth?: number;
      area?: number;
      center_x?: number;
      center_y?: number;
      center_z?: number;
      dim_x?: number;
      dim_y?: number;
      dim_z?: number;
      has_qto: boolean;
    }
  >();

  for (const [, ent] of entityMap.entries()) {
    if (ent.type === 'IFCRELDEFINESBYPROPERTIES') {
      const relMatches = ent.params.match(/\((#[0-9, #]+)\)\s*,\s*(#[0-9]+)/);
      if (!relMatches) continue;

      const elementIds = relMatches[1].split(',').map((s) => s.trim());
      const psetId = relMatches[2];
      const psetEnt = entityMap.get(psetId);
      if (!psetEnt) continue;

      for (const elId of elementIds) {
        let pdata = elementPropsMap.get(elId);
        if (!pdata) {
          pdata = { has_qto: false };
          elementPropsMap.set(elId, pdata);
        }

        if (psetEnt.type === 'IFCELEMENTQUANTITY') {
          pdata.has_qto = true;
          // Extract sub-quantities
          const subIdsMatch = psetEnt.params.match(/\((#[0-9, #]+)\)/);
          if (subIdsMatch) {
            const subIds = subIdsMatch[1].split(',').map((s) => s.trim());
            for (const sId of subIds) {
              const subEnt = entityMap.get(sId);
              if (!subEnt) continue;
              const numMatch = subEnt.params.match(/([0-9]+\.?[0-9]*(?:[eE][-+]?[0-9]+)?)/g);
              const val = numMatch && numMatch.length > 0 ? parseFloat(numMatch[numMatch.length - 1]) : null;
              if (val !== null && !isNaN(val)) {
                if (subEnt.type === 'IFCQUANTITYVOLUME') {
                  if (subEnt.params.includes('NetVolume')) pdata.net_volume = val;
                  else if (subEnt.params.includes('GrossVolume')) pdata.gross_volume = val;
                  else if (!pdata.net_volume) pdata.net_volume = val;
                } else if (subEnt.type === 'IFCQUANTITYAREA') {
                  pdata.area = val;
                } else if (subEnt.type === 'IFCQUANTITYLENGTH') {
                  if (subEnt.params.includes('Length')) pdata.length = val;
                  else if (subEnt.params.includes('Width')) pdata.width = val;
                  else if (subEnt.params.includes('Height') || subEnt.params.includes('Depth')) pdata.depth = val;
                }
              }
            }
          }
        } else if (psetEnt.type === 'IFCPROPERTYSET') {
          // Check for custom coordinate pset LTOpenBIM_Coordinates
          if (psetEnt.params.includes('LTOpenBIM_Coordinates')) {
            const subIdsMatch = psetEnt.params.match(/\((#[0-9, #]+)\)/);
            if (subIdsMatch) {
              const subIds = subIdsMatch[1].split(',').map((s) => s.trim());
              for (const sId of subIds) {
                const subEnt = entityMap.get(sId);
                if (!subEnt) continue;
                const numMatch = subEnt.params.match(/IFCREAL\s*\(\s*([-0-9.]+)\s*\)/i);
                if (numMatch) {
                  const val = parseFloat(numMatch[1]);
                  if (subEnt.params.includes('CenterX')) pdata.center_x = val;
                  else if (subEnt.params.includes('CenterY')) pdata.center_y = val;
                  else if (subEnt.params.includes('CenterZ')) pdata.center_z = val;
                  else if (subEnt.params.includes('DimX')) pdata.dim_x = val;
                  else if (subEnt.params.includes('DimY')) pdata.dim_y = val;
                  else if (subEnt.params.includes('DimZ')) pdata.dim_z = val;
                }
              }
            }
          }
        }
      }
    }
  }

  // Now assemble structural elements
  const elements: RawBIMElement[] = [];

  for (const [id, ent] of entityMap.entries()) {
    if (!STRUCTURAL_IFC_CLASSES.has(ent.type)) continue;

    const strType = ent.type.charAt(0).toUpperCase() + ent.type.slice(1).toLowerCase();
    // Re-case to standard IFC type like IfcColumn, IfcBeam, IfcSlab, IfcFooting
    const properIfcType = 'Ifc' + ent.type.substring(3).charAt(0).toUpperCase() + ent.type.substring(4).toLowerCase();

    // Extract name & global_id
    const strings = Array.from(ent.params.matchAll(/'([^']*)'/g)).map((m) => m[1]);
    const global_id = strings[0] || id;
    const name = strings[1] || `${properIfcType} ${id}`;

    const storey = elementStoreyMap.get(id) || '01 Ground Floor Level';
    const material_name = elementMaterialMap.get(id) || 'Concrete M25 RCC';
    const has_material = !material_name.toLowerCase().includes('unassigned') && !material_name.toLowerCase().includes('unspecified');

    // Concrete grade detection
    let concrete_grade = 'M25';
    let is_grade_explicit = false;
    const gradeMatch = (name + ' ' + material_name).match(CONCRETE_GRADE_REGEX);
    if (gradeMatch) {
      concrete_grade = gradeMatch[1].toUpperCase().replace(/\s+/g, '');
      is_grade_explicit = true;
    } else if (material_name.toLowerCase().includes('high strength')) {
      concrete_grade = 'M40';
      is_grade_explicit = true;
    } else if (material_name.toLowerCase().includes('rcc')) {
      concrete_grade = 'M30';
      is_grade_explicit = false;
    }

    const pdata = elementPropsMap.get(id) || { has_qto: false };
    let net_vol = pdata.net_volume ?? pdata.gross_volume ?? 0;
    const gross_vol = pdata.gross_volume ?? net_vol;

    // Dimensions
    const bbox_dx = pdata.dim_x ?? pdata.length ?? (properIfcType === 'IfcColumn' ? 0.45 : 6.0);
    const bbox_dy = pdata.dim_y ?? pdata.width ?? (properIfcType === 'IfcColumn' ? 0.6 : 0.3);
    const bbox_dz = pdata.dim_z ?? pdata.depth ?? (properIfcType === 'IfcColumn' ? 3.8 : 0.5);

    if (net_vol === 0 && bbox_dx > 0 && bbox_dy > 0 && bbox_dz > 0) {
      net_vol = parseFloat((bbox_dx * bbox_dy * bbox_dz).toFixed(4));
    }

    elements.push({
      global_id,
      tag: id,
      name,
      ifc_type: properIfcType,
      object_type: '',
      storey,
      material_name,
      concrete_grade,
      is_grade_explicit,
      has_base_quantities: pdata.has_qto,
      has_material,
      net_volume: net_vol,
      gross_volume: gross_vol,
      length: pdata.length ?? bbox_dx,
      width: pdata.width ?? bbox_dy,
      depth: pdata.depth ?? bbox_dz,
      area: pdata.area ?? parseFloat((bbox_dx * bbox_dy).toFixed(2)),
      has_geometry: true,
      center_x: pdata.center_x ?? 0,
      center_y: pdata.center_y ?? 0,
      center_z: pdata.center_z ?? 0,
      bbox_dx,
      bbox_dy,
      bbox_dz,
    });
  }

  return { metadata, elements };
}
