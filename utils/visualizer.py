"""
Interactive 3D BIM Structural Visualizer and Analytical Charting.
Built with Plotly for dynamic 3D takeoff exploration and cost variance diagnostics.
"""

from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px

# Curated Theme Color Palette
TYPE_COLORS = {
    "IfcFooting": "#F59E0B",   # Amber / Gold
    "IfcColumn": "#6366F1",    # Indigo
    "IfcBeam": "#0284C7",      # Cyan / Sky Blue
    "IfcSlab": "#10B981",      # Emerald Green
    "IfcWall": "#EC4899",      # Rose Pink
    "IfcMember": "#8B5CF6",    # Purple
    "DEFAULT": "#64748B",      # Slate Grey
}

RISK_COLORS = {
    "HIGH": "#EF4444",         # Crimson Alert
    "MEDIUM": "#F59E0B",       # Warning Amber
    "NORMAL": "#3B82F6",       # Technical Blue
}

GRADE_COLORS = {
    "M20": "#94A3B8",
    "M25": "#14B8A6",
    "M30": "#0284C7",
    "M35": "#6366F1",
    "M40": "#8B5CF6",
    "M50": "#D946EF",
    "DEFAULT": "#64748B",
}


def build_3d_bim_model(
    df: pd.DataFrame,
    color_by: str = "risk_level",
    selected_storeys: Optional[List[str]] = None,
    selected_types: Optional[List[str]] = None,
    show_bounding_boxes: bool = True,
) -> go.Figure:
    """
    Renders an interactive 3D BIM structural model using Plotly 3D.
    Displays elements in 3D coordinate space with hover cards and color coding.
    """
    if df.empty:
        fig = go.Figure()
        fig.update_layout(title="No structural elements available to visualize.")
        return fig

    dff = df.copy()
    if selected_storeys:
        dff = dff[dff["storey"].isin(selected_storeys)]
    if selected_types:
        dff = dff[dff["ifc_type"].isin(selected_types)]

    if dff.empty:
        fig = go.Figure()
        fig.update_layout(title="No elements match current filter selection.")
        return fig

    fig = go.Figure()

    # 1. 3D Elements Points / Centroids
    categories = dff[color_by].unique() if color_by in dff.columns else ["NORMAL"]

    for cat in categories:
        sub = dff[dff[color_by] == cat]
        if sub.empty:
            continue

        # Choose color mapping
        if color_by == "risk_level":
            c_val = RISK_COLORS.get(cat, "#64748B")
            marker_size = 8 if cat == "HIGH" else (6 if cat == "MEDIUM" else 5)
            marker_symbol = "diamond" if cat == "HIGH" else "circle"
        elif color_by == "ifc_type":
            c_val = TYPE_COLORS.get(cat, TYPE_COLORS["DEFAULT"])
            marker_size = 6
            marker_symbol = "circle"
        elif color_by == "concrete_grade":
            c_val = GRADE_COLORS.get(cat, GRADE_COLORS["DEFAULT"])
            marker_size = 6
            marker_symbol = "circle"
        else:
            c_val = "#0284C7"
            marker_size = 6
            marker_symbol = "circle"

        hover_texts = []
        for _, r in sub.iterrows():
            ht = (
                f"<b>{r.get('name', 'N/A')}</b><br>"
                f"Class: {r.get('ifc_type', '').replace('Ifc', '')}<br>"
                f"Level: {r.get('storey', 'N/A')}<br>"
                f"Grade: {r.get('concrete_grade', 'N/A')}<br>"
                f"Volume: {r.get('concrete_vol_cum', 0):.3f} m³<br>"
                f"Rebar: {r.get('rebar_kg', 0):.1f} kg<br>"
                f"Cost: ₹{r.get('total_cost_inr', 0):,.2f}<br>"
                f"Risk: <b>{r.get('risk_level', 'NORMAL')}</b><br>"
            )
            if r.get("risk_level") in ["HIGH", "MEDIUM"]:
                ht += f"<i>Anomaly: {r.get('anomaly_reasons', '')}</i>"
            hover_texts.append(ht)

        fig.add_trace(
            go.Scatter3d(
                x=sub["bbox_x"],
                y=sub["bbox_y"],
                z=sub["bbox_z"],
                mode="markers",
                name=f"{cat} ({len(sub)})",
                marker=dict(
                    size=marker_size,
                    color=c_val,
                    symbol=marker_symbol,
                    opacity=0.9,
                    line=dict(color="#000000", width=1 if cat == "HIGH" else 0.5)
                ),
                text=hover_texts,
                hoverinfo="text",
            )
        )

    # 2. Wireframe Bounding Box Lines (Optional Framing Visualization)
    if show_bounding_boxes:
        edge_x, edge_y, edge_z = [], [], []
        # Draw bounding boxes for columns and beams
        wireframe_candidates = dff[dff["ifc_type"].isin(["IfcColumn", "IfcBeam", "IfcFooting"])].head(120)
        
        for _, row in wireframe_candidates.iterrows():
            x, y, z = row["bbox_x"], row["bbox_y"], row["bbox_z"]
            dx, dy, dz = row["bbox_dx"] / 2.0, row["bbox_dy"] / 2.0, row["bbox_dz"] / 2.0
            
            # 8 vertices of a box
            vx = [x-dx, x+dx, x+dx, x-dx, x-dx, x-dx, x+dx, x+dx, x-dx, x-dx, x-dx, x+dx, x+dx, x+dx, x+dx, x-dx]
            vy = [y-dy, y-dy, y+dy, y+dy, y-dy, y-dy, y-dy, y+dy, y+dy, y-dy, y-dy, y-dy, y-dy, y+dy, y+dy, y+dy]
            vz = [z-dz, z-dz, z-dz, z-dz, z-dz, z+dz, z+dz, z+dz, z+dz, z+dz, z-dz, z-dz, z+dz, z+dz, z-dz, z-dz]
            
            edge_x.extend(vx + [None])
            edge_y.extend(vy + [None])
            edge_z.extend(vz + [None])

        if edge_x:
            fig.add_trace(
                go.Scatter3d(
                    x=edge_x,
                    y=edge_y,
                    z=edge_z,
                    mode="lines",
                    name="Framing Wireframe",
                    line=dict(color="#94A3B8", width=1.5),
                    opacity=0.4,
                    hoverinfo="none",
                    showlegend=True,
                )
            )

    fig.update_layout(
        scene=dict(
            xaxis=dict(title="X Axis (m)", backgroundcolor="#F8FAFC", gridcolor="#E2E8F0", showbackground=True),
            yaxis=dict(title="Y Axis (m)", backgroundcolor="#F8FAFC", gridcolor="#E2E8F0", showbackground=True),
            zaxis=dict(title="Elevation Z (m)", backgroundcolor="#F8FAFC", gridcolor="#E2E8F0", showbackground=True),
            aspectmode="data",
            camera=dict(
                eye=dict(x=1.6, y=1.6, z=1.2),
            ),
        ),
        margin=dict(l=0, r=0, b=0, t=30),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            bgcolor="rgba(255,255,255,0.85)"
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=550,
    )

    return fig


def build_cost_sunburst(df: pd.DataFrame) -> go.Figure:
    """
    Renders hierarchical cost distribution: Storey -> Element Type -> Concrete Grade.
    """
    if df.empty:
        return go.Figure()

    fig = px.sunburst(
        df,
        path=["storey", "ifc_type", "concrete_grade"],
        values="total_cost_inr",
        color="storey",
        color_discrete_sequence=px.colors.qualitative.Prism,
        title="Structural Cost Hierarchy (Storey → Type → Grade)",
    )
    fig.update_traces(textinfo="label+percent entry", hovertemplate="<b>%{label}</b><br>Cost: ₹%{value:,.2f}<br>Share: %{percentEntry:.1%}")
    fig.update_layout(margin=dict(t=40, l=10, r=10, b=10), height=450)
    return fig


def build_anomaly_scatter_plot(df: pd.DataFrame) -> go.Figure:
    """
    Renders Volume vs Cost scatter plot highlighting AI anomaly outliers.
    """
    if df.empty:
        return go.Figure()

    fig = px.scatter(
        df,
        x="concrete_vol_cum",
        y="total_cost_inr",
        color="risk_level",
        size="rebar_kg",
        symbol="risk_level",
        hover_name="name",
        hover_data={
            "storey": True,
            "ifc_type": True,
            "concrete_grade": True,
            "z_score_vol": ":.2f",
            "concrete_vol_cum": ":.3f",
            "total_cost_inr": ":,.2f",
            "risk_level": True,
        },
        color_discrete_map=RISK_COLORS,
        title="Element Volume vs Total Cost with Anomaly Outlier Detection",
        labels={
            "concrete_vol_cum": "Concrete Volume (m³)",
            "total_cost_inr": "Total Element Cost (INR)",
            "risk_level": "Risk Classification",
        }
    )

    fig.update_layout(
        template="plotly_white",
        margin=dict(t=50, l=20, r=20, b=20),
        height=450,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    return fig


def build_concrete_grade_breakdown(df: pd.DataFrame) -> go.Figure:
    """
    Bar chart showing total volume and cost per concrete grade.
    """
    if df.empty:
        return go.Figure()

    grp = df.groupby("concrete_grade").agg(
        total_vol=("concrete_vol_cum", "sum"),
        total_cost=("total_cost_inr", "sum"),
    ).reset_index()

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=grp["concrete_grade"],
            y=grp["total_vol"],
            name="Volume (m³)",
            marker_color="#0284C7",
            yaxis="y1",
        )
    )
    fig.add_trace(
        go.Bar(
            x=grp["concrete_grade"],
            y=grp["total_cost"] / 100000.0,
            name="Cost (₹ Lakhs)",
            marker_color="#F59E0B",
            yaxis="y2",
        )
    )

    fig.update_layout(
        title="Concrete Mix Consumption & Cost by Grade",
        template="plotly_white",
        yaxis=dict(title="Volume (m³)", side="left"),
        yaxis2=dict(title="Cost (₹ Lakhs)", overlaying="y", side="right"),
        barmode="group",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(t=40, l=20, r=20, b=20),
        height=380,
    )
    return fig
