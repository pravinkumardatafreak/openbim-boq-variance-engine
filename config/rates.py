"""
Schedule of Rates (SOR) and Structural Thumb Rules.
Aligned with CPWD Delhi Schedule of Rates (DSR 2023) and standard L&T EPC benchmarking.
"""

from typing import Dict, Any

# CPWD DSR 2023 & Indian EPC Standard Rates (INR)
DEFAULT_CONCRETE_RATES: Dict[str, Dict[str, Any]] = {
    "M20": {
        "code": "CPWD-DSR-05.1.2",
        "description": "Reinforced cement concrete work M20 (1:1.5:3) nominal mix in substructure/superstructure",
        "unit": "cum",
        "rate": 6250.0,
    },
    "M25": {
        "code": "CPWD-DSR-05.33.1",
        "description": "Design Mix concrete M25 using ordinary portland cement 43/53 grade in structural members",
        "unit": "cum",
        "rate": 6850.0,
    },
    "M30": {
        "code": "CPWD-DSR-05.33.2",
        "description": "Design Mix concrete M30 high strength RCC in beams, columns, suspended slabs",
        "unit": "cum",
        "rate": 7450.0,
    },
    "M35": {
        "code": "CPWD-DSR-05.33.3",
        "description": "Design Mix concrete M35 heavy load structural elements and transfer girders",
        "unit": "cum",
        "rate": 8150.0,
    },
    "M40": {
        "code": "CPWD-DSR-05.33.4",
        "description": "Design Mix concrete M40 high performance concrete for heavily loaded columns",
        "unit": "cum",
        "rate": 8900.0,
    },
    "M50": {
        "code": "CPWD-DSR-05.33.5",
        "description": "Design Mix concrete M50 specialized prestressed / high-rise structural elements",
        "unit": "cum",
        "rate": 9800.0,
    },
    "DEFAULT": {
        "code": "CPWD-DSR-05.33.1",
        "description": "Standard Structural Concrete Grade (Assumed M25)",
        "unit": "cum",
        "rate": 6850.0,
    }
}

# Steel Reinforcement (TMT Fe500 / Fe550D)
STEEL_RATES: Dict[str, Any] = {
    "code": "CPWD-DSR-05.22.6",
    "description": "Thermo-Mechanically Treated (TMT) bars Fe-500D / Fe-550 for RCC work including cutting, bending, binding",
    "unit": "tonne",
    "rate_per_tonne": 78500.0,
    "rate_per_kg": 78.50,
}

# Formwork / Shuttering Rates per sqm
FORMWORK_RATES: Dict[str, Dict[str, Any]] = {
    "IfcFooting": {
        "code": "CPWD-DSR-05.09.1",
        "description": "Centering and shuttering for foundations, footings, bases of columns",
        "unit": "sqm",
        "rate": 340.0,
    },
    "IfcColumn": {
        "code": "CPWD-DSR-05.09.2",
        "description": "Centering and shuttering for columns, pillars, piers, posts and struts",
        "unit": "sqm",
        "rate": 590.0,
    },
    "IfcBeam": {
        "code": "CPWD-DSR-05.09.3",
        "description": "Centering and shuttering for suspended floors, roofs, landings, balconies, beams and lintels",
        "unit": "sqm",
        "rate": 550.0,
    },
    "IfcSlab": {
        "code": "CPWD-DSR-05.09.4",
        "description": "Centering and shuttering for suspended slabs, roofs, floor decking",
        "unit": "sqm",
        "rate": 480.0,
    },
    "IfcWall": {
        "code": "CPWD-DSR-05.09.5",
        "description": "Centering and shuttering for walls (any thickness) including attached pilasters",
        "unit": "sqm",
        "rate": 510.0,
    },
    "DEFAULT": {
        "code": "CPWD-DSR-05.09.0",
        "description": "Centering and shuttering general structural surfaces",
        "unit": "sqm",
        "rate": 480.0,
    }
}

# Standard Reinforcement Density Thumb Rules (kg of rebar per cum of concrete)
# Based on SP-34 Handbook on Concrete Reinforcement and Detailing & CPWD Norms
REBAR_DENSITY_THUMB_RULES: Dict[str, float] = {
    "IfcFooting": 95.0,     # 80 - 110 kg/m3
    "IfcColumn": 175.0,     # 150 - 200 kg/m3
    "IfcBeam": 145.0,       # 130 - 160 kg/m3
    "IfcSlab": 105.0,       # 90 - 120 kg/m3
    "IfcWall": 115.0,       # 100 - 130 kg/m3
    "DEFAULT": 125.0,
}

# Formwork Area Multiplier (sqm of formwork contact area per cum of concrete)
# Used when explicit contact surface is not available in property sets
FORMWORK_AREA_MULTIPLIERS: Dict[str, float] = {
    "IfcFooting": 2.2,
    "IfcColumn": 8.0,
    "IfcBeam": 6.5,
    "IfcSlab": 4.5,
    "IfcWall": 7.0,
    "DEFAULT": 5.0,
}

# Pre-packaged Rate Schedules
RATE_SCHEDULE_PRESETS: Dict[str, Dict[str, Any]] = {
    "CPWD DSR 2023 (Delhi / Central India)": {
        "multiplier": 1.00,
        "description": "Central Public Works Department - Delhi Schedule of Rates 2023"
    },
    "L&T EPC Metro / Commercial Project Benchmark": {
        "multiplier": 1.08,
        "description": "Larsen & Toubro Tier-1 Metros with mechanized batching & tower crane logistics (+8%)"
    },
    "High-Rise / Heavy Civil Coastal (Mumbai / Chennai)": {
        "multiplier": 1.15,
        "description": "Specialized coastal corrosion resistance & high-workability pumping concrete (+15%)"
    },
    "Tier-2 Industrial Corridor": {
        "multiplier": 0.92,
        "description": "Regional state corridor with localized aggregate & bulk cement procurement (-8%)"
    }
}
