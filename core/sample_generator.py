"""
Sample OpenBIM IFC Model Generator for Commercial Framing Benchmark.
Synthesizes a realistic G+2 commercial framed RCC building with real IFC4 schema,
property sets (Qto_*BaseQuantities), materials, and engineered cost/volume anomalies.
"""

import os
from pathlib import Path
from typing import Optional
import ifcopenshell
import ifcopenshell.api


def generate_lt_sample_ifc(output_path: Optional[str] = None) -> str:
    """
    Generates a full-featured structural IFC model of a Commercial Framing Complex (G+2).
    Includes realistic member sizing, material grades (M25, M30, M35, M40),
    and deliberate quantity/material anomalies for algorithm validation.
    """
    if output_path is None:
        output_dir = Path("sample_models")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / "lt_commercial_tower_sample.ifc")

    # If already exists and is non-empty, return path
    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        return output_path

    model = ifcopenshell.file(schema="IFC4")

    # 1. Spatial Structure
    project = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcProject", name="L&T IT Complex - Block B")
    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="Chennai SEZ Park")
    building = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuilding", name="Tower B Commercial Hub")

    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=project, products=[site])
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=site, products=[building])

    # Storeys
    storey_found = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="00 Substructure / Foundation")
    storey_ground = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="01 Ground Floor Level")
    storey_first = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="02 First Floor Level")
    storey_roof = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="03 Second Floor / Roof")

    for s in [storey_found, storey_ground, storey_first, storey_roof]:
        ifcopenshell.api.run("aggregate.assign_object", model, relating_object=building, products=[s])

    # 2. Materials
    mat_m20 = ifcopenshell.api.run("material.add_material", model, name="Concrete M20 PCC")
    mat_m25 = ifcopenshell.api.run("material.add_material", model, name="Concrete M25 RCC")
    mat_m30 = ifcopenshell.api.run("material.add_material", model, name="Concrete M30 RCC")
    mat_m35 = ifcopenshell.api.run("material.add_material", model, name="Concrete M35 High Strength")
    mat_m40 = ifcopenshell.api.run("material.add_material", model, name="Concrete M40 Column Mix")

    # Grid specifications: 4x4 columns (3 bays x 3 bays of 6.0m span)
    grid_spacing = 6.0
    floor_height = 3.8

    # =========================================================================
    # A. FOUNDATION (16 Isolated Footings)
    # =========================================================================
    for i in range(4):
        for j in range(4):
            tag = f"F-{i+1}{j+1}"
            x = i * grid_spacing
            y = j * grid_spacing
            z = -2.0

            # Default dimensions: 2.2m x 2.2m x 0.65m = 3.146 m3
            dx, dy, dz = 2.20, 2.20, 0.65
            mat = mat_m25

            # Intentional Anomaly 4: Footing F-23 has an abnormal 12.5 m3 volume jump (oversized raft-stub typo)
            if i == 1 and j == 2:
                dx, dy, dz = 4.20, 4.20, 0.75  # 13.23 m3!

            vol = round(dx * dy * dz, 4)
            area = round(dx * dy, 2)

            footing = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcFooting", name=f"Isolated Footing {tag}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_found, products=[footing])
            ifcopenshell.api.run("material.assign_material", model, products=[footing], material=mat)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=footing, name="Qto_FootingBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol,
                "GrossVolume": vol,
                "GrossFloorArea": area,
                "Height": dz,
                "Width": dy,
                "Length": dx
            })

            # Custom dimensions pset for visualizer bounding box
            pset = ifcopenshell.api.run("pset.add_pset", model, product=footing, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": x, "CenterY": y, "CenterZ": z + dz / 2.0,
                "DimX": dx, "DimY": dy, "DimZ": dz
            })

    # =========================================================================
    # B. GROUND FLOOR (16 Columns, 24 Beams, 9 Slabs)
    # =========================================================================
    # 1. Columns (M40)
    for i in range(4):
        for j in range(4):
            tag = f"C-GF-{i+1}{j+1}"
            x = i * grid_spacing
            y = j * grid_spacing
            z = 0.0
            cx, cy, cz = 0.45, 0.60, floor_height
            mat = mat_m40

            # Intentional Anomaly 1: Column C-GF-32 has a depth typo in model (2.40m instead of 0.60m => 4x volume jump)
            if i == 2 and j == 1:
                cy = 2.40

            vol = round(cx * cy * cz, 4)
            area = round(cx * cy, 3)

            col = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name=f"Column {tag} (M40)")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_ground, products=[col])
            ifcopenshell.api.run("material.assign_material", model, products=[col], material=mat)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=col, name="Qto_ColumnBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol,
                "GrossVolume": vol,
                "Length": cz,
                "CrossSectionArea": area
            })

            pset = ifcopenshell.api.run("pset.add_pset", model, product=col, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": x, "CenterY": y, "CenterZ": z + cz / 2.0,
                "DimX": cx, "DimY": cy, "DimZ": cz
            })

    # 2. Beams (M30)
    # X-direction beams (3 spans x 4 lines = 12 beams)
    for i in range(3):
        for j in range(4):
            bx = (i + 0.5) * grid_spacing
            by = j * grid_spacing
            bz = floor_height
            bdx, bdy, bdz = grid_spacing, 0.30, 0.50
            vol = round(bdx * bdy * bdz, 4)
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=f"Plinth Beam B-GF-X{i+1}-{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_ground, products=[beam])
            ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m30)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdx, "CrossSectionArea": round(bdy * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    # Y-direction beams (4 lines x 3 spans = 12 beams)
    for i in range(4):
        for j in range(3):
            bx = i * grid_spacing
            by = (j + 0.5) * grid_spacing
            bz = floor_height
            bdx, bdy, bdz = 0.30, grid_spacing, 0.50
            vol = round(bdx * bdy * bdz, 4)
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=f"Plinth Beam B-GF-Y{i+1}-{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_ground, products=[beam])
            ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m30)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdy, "CrossSectionArea": round(bdx * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    # 3. Slabs (9 panels, M25)
    for i in range(3):
        for j in range(3):
            sx = (i + 0.5) * grid_spacing
            sy = (j + 0.5) * grid_spacing
            sz = floor_height
            sdx, sdy, sdz = grid_spacing - 0.30, grid_spacing - 0.30, 0.15
            vol = round(sdx * sdy * sdz, 4)
            slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"Floor Slab S-GF-Bay{i+1}{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_ground, products=[slab])
            ifcopenshell.api.run("material.assign_material", model, products=[slab], material=mat_m25)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=slab, name="Qto_SlabBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "NetArea": round(sdx * sdy, 2), "Thickness": sdz
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=slab, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": sx, "CenterY": sy, "CenterZ": sz - sdz / 2.0, "DimX": sdx, "DimY": sdy, "DimZ": sdz
            })

    # =========================================================================
    # C. FIRST FLOOR (16 Columns, 24 Beams, 9 Slabs)
    # =========================================================================
    # 1. Columns (M35)
    for i in range(4):
        for j in range(4):
            tag = f"C-1F-{i+1}{j+1}"
            x = i * grid_spacing
            y = j * grid_spacing
            z = floor_height
            cx, cy, cz = 0.40, 0.50, floor_height
            vol = round(cx * cy * cz, 4)
            area = round(cx * cy, 3)

            col = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name=f"Column {tag} (M35)")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_first, products=[col])
            ifcopenshell.api.run("material.assign_material", model, products=[col], material=mat_m35)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=col, name="Qto_ColumnBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": cz, "CrossSectionArea": area
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=col, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": x, "CenterY": y, "CenterZ": z + cz / 2.0, "DimX": cx, "DimY": cy, "DimZ": cz
            })

    # 2. Beams (M30, with Anomaly 2: Beam B-1F-X2-2 has missing material and concrete grade)
    for i in range(3):
        for j in range(4):
            bx = (i + 0.5) * grid_spacing
            by = j * grid_spacing
            bz = floor_height * 2.0
            bdx, bdy, bdz = grid_spacing, 0.30, 0.45
            vol = round(bdx * bdy * bdz, 4)
            is_anomaly_2 = (i == 1 and j == 1)

            beam_name = "Floor Beam B-1F-X2-2 (UNASSIGNED SPEC)" if is_anomaly_2 else f"Floor Beam B-1F-X{i+1}-{j+1}"
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=beam_name)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_first, products=[beam])

            if not is_anomaly_2:
                ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m30)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdx, "CrossSectionArea": round(bdy * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    for i in range(4):
        for j in range(3):
            bx = i * grid_spacing
            by = (j + 0.5) * grid_spacing
            bz = floor_height * 2.0
            bdx, bdy, bdz = 0.30, grid_spacing, 0.45
            vol = round(bdx * bdy * bdz, 4)
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=f"Floor Beam B-1F-Y{i+1}-{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_first, products=[beam])
            ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m30)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdy, "CrossSectionArea": round(bdx * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    # 3. Slabs (9 panels, M25, with Anomaly 3: Slab S-1F-Bay13 has corrupted 0.001 m3 Qto NetVolume)
    for i in range(3):
        for j in range(3):
            sx = (i + 0.5) * grid_spacing
            sy = (j + 0.5) * grid_spacing
            sz = floor_height * 2.0
            sdx, sdy, sdz = grid_spacing - 0.30, grid_spacing - 0.30, 0.15
            vol = round(sdx * sdy * sdz, 4)
            is_anomaly_3 = (i == 0 and j == 2)
            if is_anomaly_3:
                vol = 0.001  # corrupted record in Revit Qto

            slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"Floor Slab S-1F-Bay{i+1}{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_first, products=[slab])
            ifcopenshell.api.run("material.assign_material", model, products=[slab], material=mat_m25)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=slab, name="Qto_SlabBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "NetArea": round(sdx * sdy, 2), "Thickness": sdz
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=slab, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": sx, "CenterY": sy, "CenterZ": sz - sdz / 2.0, "DimX": sdx, "DimY": sdy, "DimZ": sdz
            })

    # =========================================================================
    # D. SECOND FLOOR / ROOF LEVEL (16 Columns, 24 Beams, 9 Roof Slabs)
    # =========================================================================
    # 1. Roof Columns (M30)
    for i in range(4):
        for j in range(4):
            tag = f"C-2F-{i+1}{j+1}"
            x = i * grid_spacing
            y = j * grid_spacing
            z = floor_height * 2.0
            cx, cy, cz = 0.35, 0.45, floor_height
            vol = round(cx * cy * cz, 4)
            area = round(cx * cy, 3)

            col = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name=f"Roof Column {tag} (M30)")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_roof, products=[col])
            ifcopenshell.api.run("material.assign_material", model, products=[col], material=mat_m30)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=col, name="Qto_ColumnBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": cz, "CrossSectionArea": area
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=col, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": x, "CenterY": y, "CenterZ": z + cz / 2.0, "DimX": cx, "DimY": cy, "DimZ": cz
            })

    # 2. Roof Beams (M25)
    for i in range(3):
        for j in range(4):
            bx = (i + 0.5) * grid_spacing
            by = j * grid_spacing
            bz = floor_height * 3.0
            bdx, bdy, bdz = grid_spacing, 0.25, 0.40
            vol = round(bdx * bdy * bdz, 4)
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=f"Roof Beam B-RF-X{i+1}-{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_roof, products=[beam])
            ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m25)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdx, "CrossSectionArea": round(bdy * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    for i in range(4):
        for j in range(3):
            bx = i * grid_spacing
            by = (j + 0.5) * grid_spacing
            bz = floor_height * 3.0
            bdx, bdy, bdz = 0.25, grid_spacing, 0.40
            vol = round(bdx * bdy * bdz, 4)
            beam = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBeam", name=f"Roof Beam B-RF-Y{i+1}-{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_roof, products=[beam])
            ifcopenshell.api.run("material.assign_material", model, products=[beam], material=mat_m25)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=beam, name="Qto_BeamBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "Length": bdy, "CrossSectionArea": round(bdx * bdz, 3)
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=beam, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": bx, "CenterY": by, "CenterZ": bz - bdz / 2.0, "DimX": bdx, "DimY": bdy, "DimZ": bdz
            })

    # 3. Roof Slabs (9 panels, M25)
    for i in range(3):
        for j in range(3):
            sx = (i + 0.5) * grid_spacing
            sy = (j + 0.5) * grid_spacing
            sz = floor_height * 3.0
            sdx, sdy, sdz = grid_spacing - 0.25, grid_spacing - 0.25, 0.125
            vol = round(sdx * sdy * sdz, 4)
            slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"Roof Slab S-RF-Bay{i+1}{j+1}")
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_roof, products=[slab])
            ifcopenshell.api.run("material.assign_material", model, products=[slab], material=mat_m25)

            qto = ifcopenshell.api.run("pset.add_qto", model, product=slab, name="Qto_SlabBaseQuantities")
            ifcopenshell.api.run("pset.edit_qto", model, qto=qto, properties={
                "NetVolume": vol, "GrossVolume": vol, "NetArea": round(sdx * sdy, 2), "Thickness": sdz
            })
            pset = ifcopenshell.api.run("pset.add_pset", model, product=slab, name="LTOpenBIM_Coordinates")
            ifcopenshell.api.run("pset.edit_pset", model, pset=pset, properties={
                "CenterX": sx, "CenterY": sy, "CenterZ": sz - sdz / 2.0, "DimX": sdx, "DimY": sdy, "DimZ": sdz
            })

    model.write(output_path)
    return output_path


if __name__ == "__main__":
    path = generate_lt_sample_ifc()
    print(f"Generated sample model at: {path}")
