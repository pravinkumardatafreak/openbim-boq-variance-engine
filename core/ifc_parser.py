"""
OpenBIM IFC Model Parser using IfcOpenShell.
Extracts structural elements, property sets, geometric quantities, and spatial hierarchies.
"""

import os
import re
import tempfile
import logging
from typing import Dict, Any, List, Tuple, Optional, Union
from pathlib import Path
import pandas as pd
import numpy as np

import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement

try:
    import ifcopenshell.geom
    HAS_GEOM = True
except Exception:
    HAS_GEOM = False

logger = logging.getLogger(__name__)

# Standard structural classes targeted for Takeoff & BOQ
STRUCTURAL_IFC_CLASSES = [
    "IfcFooting",
    "IfcPile",
    "IfcColumn",
    "IfcBeam",
    "IfcMember",
    "IfcSlab",
    "IfcWall",
    "IfcWallStandardCase",
    "IfcPlate",
    "IfcRoof",
    "IfcStairFlight",
]

CONCRETE_GRADE_PATTERN = re.compile(r"\b(M\s*15|M\s*20|M\s*25|M\s*30|M\s*35|M\s*40|M\s*50|M\s*60)\b", re.IGNORECASE)
STEEL_GRADE_PATTERN = re.compile(r"\b(Fe\s*415|Fe\s*500|Fe\s*500D|Fe\s*550|Fe\s*550D)\b", re.IGNORECASE)


def extract_concrete_grade(name: str, material_str: str, psets: Dict[str, Any]) -> Tuple[str, bool]:
    """
    Extracts Indian standard concrete grade (e.g., M25, M30, M40) from name,
    material name, or property sets. Returns (grade, is_explicit).
    """
    text_corpus = f"{name} {material_str}"
    
    # Check psets for explicit grade properties
    for pset_name, props in psets.items():
        if isinstance(props, dict):
            for k, v in props.items():
                if any(kw in k.lower() for kw in ["grade", "strength", "concrete", "mix"]):
                    text_corpus += f" {v}"
    
    match = CONCRETE_GRADE_PATTERN.search(text_corpus)
    if match:
        grade = match.group(1).upper().replace(" ", "")
        return grade, True
    
    # Check for keywords indicating high-strength or standard
    if "high strength" in text_corpus.lower():
        return "M40", True
    if "rcc" in text_corpus.lower() or "reinforced" in text_corpus.lower():
        return "M30", False
    if "pcc" in text_corpus.lower() or "lean" in text_corpus.lower():
        return "M20", True
    
    # Fallback to standard default
    return "M25", False


def extract_quantities_from_psets(psets: Dict[str, Any]) -> Dict[str, Optional[float]]:
    """
    Scans element property sets and quantity sets (Qto_*) for volume, area, and length.
    """
    res = {
        "net_volume": None,
        "gross_volume": None,
        "net_area": None,
        "gross_area": None,
        "length": None,
        "width": None,
        "depth": None,
        "has_qto": False,
    }

    volume_keys = ["netvolume", "grossvolume", "volume", "nominalvolume"]
    area_keys = ["netarea", "grossarea", "area", "crosssectionarea", "footprintarea", "outersurfacearea"]
    length_keys = ["length", "span", "height", "nominalheight", "clearheight", "depth"]

    for pset_name, props in psets.items():
        if not isinstance(props, dict):
            continue
        
        is_qto = "qto" in pset_name.lower() or "quantity" in pset_name.lower()
        if is_qto:
            res["has_qto"] = True

        for k, v in props.items():
            if not isinstance(v, (int, float)) or v is None:
                continue
            k_lower = k.lower()
            
            # Volume detection
            if "netvolume" in k_lower and res["net_volume"] is None:
                res["net_volume"] = float(v)
            elif ("grossvolume" in k_lower or "volume" in k_lower) and res["gross_volume"] is None:
                res["gross_volume"] = float(v)
            
            # Area detection
            if "netarea" in k_lower and res["net_area"] is None:
                res["net_area"] = float(v)
            elif "area" in k_lower and res["gross_area"] is None:
                res["gross_area"] = float(v)
            
            # Dimensions
            if any(lk == k_lower for lk in length_keys) and res["length"] is None:
                res["length"] = float(v)
            if "width" in k_lower and res["width"] is None:
                res["width"] = float(v)
            if any(dk in k_lower for dk in ["depth", "thickness", "flangethickness"]) and res["depth"] is None:
                res["depth"] = float(v)

    if res["net_volume"] is None and res["gross_volume"] is not None:
        res["net_volume"] = res["gross_volume"]
    elif res["gross_volume"] is None and res["net_volume"] is not None:
        res["gross_volume"] = res["net_volume"]

    return res


class IFCModelParser:
    """
    Parser for OpenBIM IFC architectural and structural models.
    """

    def __init__(self, file_source: Union[str, Path, bytes, Any]):
        """
        Accepts a filepath (str or Path), bytes, or Streamlit UploadedFile.
        """
        self.file_path: Optional[str] = None
        self.is_temp_file: bool = False
        self.ifc_file: Optional[ifcopenshell.file] = None

        if isinstance(file_source, (str, Path)):
            self.file_path = str(file_source)
            self.ifc_file = ifcopenshell.open(self.file_path)
        else:
            # Bytes or UploadedFile: write to a clean temporary file
            with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as tmp:
                if hasattr(file_source, "read"):
                    tmp.write(file_source.read())
                    if hasattr(file_source, "seek"):
                        file_source.seek(0)
                elif isinstance(file_source, bytes):
                    tmp.write(file_source)
                self.file_path = tmp.name
                self.is_temp_file = True
            self.ifc_file = ifcopenshell.open(self.file_path)

        # Initialize geom engine settings for fallback & 3D mesh calculation
        self.geom_settings = None
        if HAS_GEOM:
            try:
                self.geom_settings = ifcopenshell.geom.settings()
                self.geom_settings.set(self.geom_settings.USE_WORLD_COORDS, True)
            except Exception as e:
                logger.warning(f"ifcopenshell.geom engine initialization warning: {e}")

    def __del__(self):
        """Cleanup temporary file if created."""
        if self.is_temp_file and self.file_path and os.path.exists(self.file_path):
            try:
                os.remove(self.file_path)
            except Exception:
                pass

    def get_model_metadata(self) -> Dict[str, Any]:
        """
        Extracts top-level IFC header, project, and application metadata.
        """
        if not self.ifc_file:
            return {}

        schema = self.ifc_file.schema
        project_name = "Untitled Project"
        site_name = "N/A"
        building_name = "Main Building"
        author = "BIM Engineer"
        originating_system = "OpenBIM Exporter"

        try:
            projects = self.ifc_file.by_type("IfcProject")
            if projects:
                project_name = projects[0].Name or project_name
        except Exception:
            pass

        try:
            sites = self.ifc_file.by_type("IfcSite")
            if sites:
                site_name = sites[0].Name or site_name
        except Exception:
            pass

        try:
            buildings = self.ifc_file.by_type("IfcBuilding")
            if buildings:
                building_name = buildings[0].Name or building_name
        except Exception:
            pass

        # Try extracting header info
        try:
            header = self.ifc_file.header
            if hasattr(header, "file_name"):
                author = getattr(header.file_name, "author", [author])[0] if getattr(header.file_name, "author", None) else author
                originating_system = getattr(header.file_name, "originating_system", originating_system)
        except Exception:
            pass

        return {
            "schema": schema,
            "project_name": project_name,
            "site_name": site_name,
            "building_name": building_name,
            "author": author,
            "originating_system": originating_system,
            "total_entities": len(self.ifc_file.by_type("IfcRoot")),
        }

    def parse_elements(self, compute_3d: bool = True) -> pd.DataFrame:
        """
        Extracts all structural elements into a standardized Pandas DataFrame.
        """
        if not self.ifc_file:
            return pd.DataFrame()

        records: List[Dict[str, Any]] = []

        for ifc_class in STRUCTURAL_IFC_CLASSES:
            try:
                elements = self.ifc_file.by_type(ifc_class)
            except Exception:
                continue

            for el in elements:
                global_id = el.GlobalId
                name = el.Name or f"{ifc_class}_{el.id()}"
                tag = getattr(el, "Tag", None) or f"#{el.id()}"
                object_type = getattr(el, "ObjectType", None) or ""

                # Spatial Storey container
                storey_name = "Unassigned Storey"
                try:
                    container = ifcopenshell.util.element.get_container(el)
                    if container and container.is_a("IfcBuildingStorey"):
                        storey_name = container.Name or f"Level {container.id()}"
                    elif container:
                        storey_name = container.Name or "Substructure"
                except Exception:
                    pass

                # Material Association
                material_str = ""
                has_material = False
                try:
                    mat = ifcopenshell.util.element.get_material(el)
                    if mat:
                        if hasattr(mat, "Name") and mat.Name:
                            material_str = mat.Name
                            has_material = True
                        elif hasattr(mat, "Materials"):  # MaterialList
                            material_str = ", ".join([m.Name for m in mat.Materials if hasattr(m, "Name") and m.Name])
                            has_material = bool(material_str)
                        elif hasattr(mat, "MaterialLayers"):  # MaterialLayerSet
                            material_str = ", ".join([ml.Material.Name for ml in mat.MaterialLayers if ml.Material and ml.Material.Name])
                            has_material = bool(material_str)
                except Exception:
                    pass

                # Property Sets and Quantities
                psets: Dict[str, Any] = {}
                try:
                    psets = ifcopenshell.util.element.get_psets(el)
                except Exception:
                    pass

                qto_data = extract_quantities_from_psets(psets)
                concrete_grade, is_grade_explicit = extract_concrete_grade(name, material_str, psets)

                # Geometry calculation (vertices, bounding box, 3D centroid)
                bbox_data = {
                    "bbox_x": 0.0, "bbox_y": 0.0, "bbox_z": 0.0,
                    "bbox_dx": 1.0, "bbox_dy": 1.0, "bbox_dz": 1.0,
                    "calc_volume": 0.0,
                    "calc_area": 0.0,
                    "has_geometry": False
                }

                # Check for explicit coordinate/dimension psets (e.g. from Revit or sample generator)
                coord_pset = psets.get("LTOpenBIM_Coordinates") or psets.get("Coordinates") or psets.get("BoundingBox")
                if isinstance(coord_pset, dict) and "CenterX" in coord_pset:
                    try:
                        bbox_data["bbox_x"] = float(coord_pset.get("CenterX", 0.0))
                        bbox_data["bbox_y"] = float(coord_pset.get("CenterY", 0.0))
                        bbox_data["bbox_z"] = float(coord_pset.get("CenterZ", 0.0))
                        bbox_data["bbox_dx"] = float(coord_pset.get("DimX", 1.0))
                        bbox_data["bbox_dy"] = float(coord_pset.get("DimY", 1.0))
                        bbox_data["bbox_dz"] = float(coord_pset.get("DimZ", 1.0))
                        bbox_data["calc_volume"] = float(bbox_data["bbox_dx"] * bbox_data["bbox_dy"] * bbox_data["bbox_dz"])
                        bbox_data["calc_area"] = float(2 * (bbox_data["bbox_dx"] * bbox_data["bbox_dy"] + bbox_data["bbox_dy"] * bbox_data["bbox_dz"] + bbox_data["bbox_dz"] * bbox_data["bbox_dx"]))
                        bbox_data["has_geometry"] = True
                    except Exception:
                        pass
                elif compute_3d and self.geom_settings is not None and HAS_GEOM:
                    try:
                        shape = ifcopenshell.geom.create_shape(self.geom_settings, el)
                        if shape and hasattr(shape, "geometry"):
                            verts = shape.geometry.verts
                            if verts and len(verts) >= 9:
                                xs = verts[0::3]
                                ys = verts[1::3]
                                zs = verts[2::3]
                                min_x, max_x = min(xs), max(xs)
                                min_y, max_y = min(ys), max(ys)
                                min_z, max_z = min(zs), max(zs)
                                dx = max(max_x - min_x, 0.05)
                                dy = max(max_y - min_y, 0.05)
                                dz = max(max_z - min_z, 0.05)
                                
                                bbox_data["bbox_x"] = float((min_x + max_x) / 2.0)
                                bbox_data["bbox_y"] = float((min_y + max_y) / 2.0)
                                bbox_data["bbox_z"] = float((min_z + max_z) / 2.0)
                                bbox_data["bbox_dx"] = float(dx)
                                bbox_data["bbox_dy"] = float(dy)
                                bbox_data["bbox_dz"] = float(dz)
                                bbox_data["calc_volume"] = float(dx * dy * dz)
                                bbox_data["calc_area"] = float(2 * (dx * dy + dy * dz + dz * dx))
                                bbox_data["has_geometry"] = True
                    except Exception:
                        pass

                # Resolve NetVolume with robust hierarchical fallback
                net_volume = qto_data["net_volume"]
                gross_volume = qto_data["gross_volume"]

                if net_volume is None or net_volume <= 0:
                    if bbox_data["has_geometry"] and bbox_data["calc_volume"] > 0:
                        # For beams/slabs/columns, bounding box is an upper bound approximation
                        vol_factor = 0.85 if ifc_class in ["IfcBeam", "IfcColumn", "IfcSlab"] else 1.0
                        net_volume = round(bbox_data["calc_volume"] * vol_factor, 4)
                    else:
                        # Fallback default reasonable structural member size
                        defaults = {
                            "IfcFooting": 2.50,
                            "IfcColumn": 0.72,
                            "IfcBeam": 0.65,
                            "IfcSlab": 4.50,
                            "IfcWall": 3.20,
                        }
                        net_volume = defaults.get(ifc_class, 0.50)

                if gross_volume is None or gross_volume <= 0:
                    gross_volume = net_volume

                # Resolve Length and Area
                length = qto_data["length"]
                if length is None or length <= 0:
                    if bbox_data["has_geometry"]:
                        length = max(bbox_data["bbox_dx"], bbox_data["bbox_dy"], bbox_data["bbox_dz"])
                    else:
                        length = 3.0

                area = qto_data["net_area"] or qto_data["gross_area"]
                if area is None or area <= 0:
                    if bbox_data["has_geometry"]:
                        area = max(bbox_data["bbox_dx"] * bbox_data["bbox_dy"], bbox_data["bbox_dy"] * bbox_data["bbox_dz"])
                    else:
                        area = round(net_volume / max(length, 0.1), 3)

                records.append({
                    "global_id": global_id,
                    "tag": tag,
                    "name": name,
                    "ifc_type": ifc_class,
                    "object_type": object_type,
                    "storey": storey_name,
                    "material_name": material_str if has_material else "Unassigned",
                    "concrete_grade": concrete_grade,
                    "is_grade_explicit": is_grade_explicit,
                    "has_base_quantities": qto_data["has_qto"],
                    "has_material": has_material,
                    "net_volume": round(float(net_volume), 4),
                    "gross_volume": round(float(gross_volume), 4),
                    "length": round(float(length), 3),
                    "area": round(float(area), 3),
                    "bbox_x": bbox_data["bbox_x"],
                    "bbox_y": bbox_data["bbox_y"],
                    "bbox_z": bbox_data["bbox_z"],
                    "bbox_dx": bbox_data["bbox_dx"],
                    "bbox_dy": bbox_data["bbox_dy"],
                    "bbox_dz": bbox_data["bbox_dz"],
                    "has_geometry": bbox_data["has_geometry"],
                    "psets_count": len(psets),
                })

        df = pd.DataFrame(records)
        if df.empty:
            logger.warning("No structural elements discovered in IFC model.")
        return df
