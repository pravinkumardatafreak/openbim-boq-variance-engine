import os
from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin

W, H = 1080, 1350
BG_COLOR = (11, 17, 32) # #0B1120
CARD_BG = (17, 24, 39)  # #111827
CARD_BORDER = (51, 65, 85) # #334155
TEXT_WHITE = (248, 250, 252) # #F8FAFC
TEXT_MUTED = (148, 163, 184) # #94A3B8
TEXT_DIM = (100, 116, 139) # #64748B
CYAN = (56, 189, 248) # #38BDF8
INDIGO = (129, 140, 248) # #818CF8
EMERALD = (52, 211, 153) # #34D399
CRIMSON = (248, 113, 113) # #F87171
AMBER = (251, 191, 36) # #FBBF24

FONT_DIR = "C:/Windows/Fonts"
font_bold_path = os.path.join(FONT_DIR, "segoeuib.ttf")
font_reg_path = os.path.join(FONT_DIR, "segoeui.ttf")
font_mono_path = os.path.join(FONT_DIR, "consola.ttf")

f_title = ImageFont.truetype(font_bold_path, 54)
f_h2 = ImageFont.truetype(font_bold_path, 42)
f_h3 = ImageFont.truetype(font_bold_path, 32)
f_body_bold = ImageFont.truetype(font_bold_path, 26)
f_body = ImageFont.truetype(font_reg_path, 25)
f_small = ImageFont.truetype(font_reg_path, 20)
f_tag = ImageFont.truetype(font_bold_path, 18)
f_mono = ImageFont.truetype(font_mono_path, 22)
f_stat_num = ImageFont.truetype(font_bold_path, 72)

def create_base_slide(page_num, total_pages=9):
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Ambient top glow
    for r in range(120, 0, -20):
        alpha_color = (15 + r//10, 23 + r//6, 42 + r//4)
        draw.ellipse([-100, -100, W + 100, 260], fill=alpha_color)
    
    # Footer border line
    draw.line([(70, H - 90), (W - 70, H - 90)], fill=(30, 41, 59), width=2)
    
    # Footer Branding
    draw.text((70, H - 65), "OpenBIM & Agentic AI Architecture", font=f_small, fill=TEXT_MUTED)
    
    # Page indicator pill
    page_str = f"{page_num} / {total_pages}"
    draw.rounded_rectangle([W - 170, H - 75, W - 70, H - 40], radius=8, fill=(30, 41, 59), outline=CYAN, width=1)
    draw.text((W - 145, H - 68), page_str, font=f_small, fill=CYAN)
    
    return img, draw

def draw_top_pill(draw, text, color=CYAN, bg=(15, 23, 42)):
    draw.rounded_rectangle([70, 70, 70 + len(text)*11 + 30, 110], radius=8, fill=bg, outline=color, width=1)
    draw.text((85, 78), text, font=f_tag, fill=color)

slides = []

# ==================== SLIDE 1: COVER ====================
img1, d1 = create_base_slide(1)
draw_top_pill(d1, "AI-NATIVE ARCHITECTURE • SOTA GOVERNANCE", CYAN)

d1.text((70, 150), "Autonomous", font=f_title, fill=TEXT_WHITE)
d1.text((70, 225), "AI Agents", font=f_title, fill=CYAN)
d1.text((70, 300), "Are Breaking", font=f_title, fill=TEXT_WHITE)
d1.text((70, 375), "Enterprise Systems.", font=f_title, fill=TEXT_WHITE)

d1.text((70, 480), "How to build AI-native presentation guardrails with the", font=f_body, fill=TEXT_MUTED)
d1.text((70, 520), "Clarity.js Dual-Audience Protocol & Certified Human Oversight.", font=f_body_bold, fill=INDIGO)

# Visual Graphic Card
d1.rounded_rectangle([70, 600, W - 70, 1080], radius=24, fill=(15, 23, 42), outline=CARD_BORDER, width=2)

# Sub-graphic in card
d1.rounded_rectangle([110, 640, 500, 780], radius=16, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
d1.text((140, 670), "AUTONOMOUS AGENT", font=f_tag, fill=TEXT_MUTED)
d1.text((140, 705), "Stagehand / Claude Computer Use", font=f_body_bold, fill=TEXT_WHITE)

d1.line([(305, 780), (305, 830)], fill=CRIMSON, width=3)
d1.polygon([(295, 830), (315, 830), (305, 850)], fill=CRIMSON)

# Shield block
d1.rounded_rectangle([110, 860, W - 110, 1030], radius=16, fill=(45, 15, 20), outline=CRIMSON, width=2)
d1.text((150, 890), "⛔  PRESENTATION-LAYER SECURITY FIREWALL", font=f_body_bold, fill=CRIMSON)
d1.text((150, 935), "Action 'overrideSafetyDefects' BLOCKED by ai:forbidden policy.", font=f_body, fill=TEXT_WHITE)
d1.text((150, 975), "Autonomous agents are physically shielded from direct ledger writes.", font=f_small, fill=TEXT_MUTED)

# Swipe instruction
d1.text((70, 1140), "Swipe to see the architecture  →", font=f_h3, fill=CYAN)
slides.append(img1)

# ==================== SLIDE 2: THE PROBLEM ====================
img2, d2 = create_base_slide(2)
draw_top_pill(d2, "THE BOTTLENECK", CRIMSON, bg=(35, 15, 15))

d2.text((70, 140), "3 Fatal Flaws of", font=f_title, fill=TEXT_WHITE)
d2.text((70, 215), "Raw DOM Scraping", font=f_title, fill=CRIMSON)
d2.text((70, 300), "Why letting LLMs inspect raw HTML breaks production systems:", font=f_body, fill=TEXT_MUTED)

# Card 1
d2.rounded_rectangle([70, 360, W - 70, 540], radius=16, fill=CARD_BG, outline=CARD_BORDER, width=1)
d2.rounded_rectangle([95, 385, 165, 435], radius=10, fill=(30, 41, 59))
d2.text((115, 395), "01", font=f_body_bold, fill=CYAN)
d2.text((190, 395), "Brittle DOM Heuristics", font=f_h3, fill=TEXT_WHITE)
d2.text((95, 455), "Agents guess coordinates. When CSS, Tailwind, or responsive", font=f_body, fill=TEXT_MUTED)
d2.text((95, 490), "layouts change, optical bounding boxes break immediately.", font=f_body, fill=TEXT_MUTED)

# Card 2
d2.rounded_rectangle([70, 565, W - 70, 745], radius=16, fill=CARD_BG, outline=CARD_BORDER, width=1)
d2.rounded_rectangle([95, 590, 165, 640], radius=10, fill=(30, 41, 59))
d2.text((115, 600), "02", font=f_body_bold, fill=AMBER)
d2.text((190, 600), "Token Hemorrhage", font=f_h3, fill=TEXT_WHITE)
d2.text((95, 660), "Dumping full-page HTML trees burns 8,500+ tokens per step,", font=f_body, fill=TEXT_MUTED)
d2.text((95, 695), "inflating LLM API inference costs and latency by 10x.", font=f_body, fill=TEXT_MUTED)

# Card 3
d2.rounded_rectangle([70, 770, W - 70, 950], radius=16, fill=CARD_BG, outline=CARD_BORDER, width=1)
d2.rounded_rectangle([95, 795, 165, 845], radius=10, fill=(30, 41, 59))
d2.text((115, 805), "03", font=f_body_bold, fill=CRIMSON)
d2.text((190, 805), "Zero Permission Boundary", font=f_h3, fill=TEXT_WHITE)
d2.text((95, 865), "Agents have raw access to click any button, risking accidental", font=f_body, fill=TEXT_MUTED)
d2.text((95, 900), "approvals of multi-crore contractor overbilling claims.", font=f_body, fill=TEXT_MUTED)

# Bottom Stat Card
d2.rounded_rectangle([70, 980, W - 70, 1140], radius=16, fill=(20, 25, 45), outline=INDIGO, width=2)
d2.text((100, 1010), "INDUSTRY REALITY CHECK:", font=f_tag, fill=INDIGO)
d2.text((100, 1050), "42% of enterprise agentic workflows fail due to unhandled UI mutations.", font=f_body_bold, fill=TEXT_WHITE)
slides.append(img2)

# ==================== SLIDE 3: DUAL-AUDIENCE ====================
img3, d3 = create_base_slide(3)
draw_top_pill(d3, "THE ARCHITECTURAL SHIFT", INDIGO, bg=(20, 20, 45))

d3.text((70, 140), "Dual-Audience", font=f_title, fill=TEXT_WHITE)
d3.text((70, 215), "Architecture", font=f_title, fill=INDIGO)
d3.text((70, 300), "Stop forcing AI agents to browse like humans. Decouple the UI:", font=f_body, fill=TEXT_MUTED)

# Human Box
d3.rounded_rectangle([70, 360, W - 70, 680], radius=20, fill=CARD_BG, outline=(51, 65, 85), width=1)
d3.rounded_rectangle([100, 390, 340, 435], radius=8, fill=(30, 41, 59))
d3.text((120, 400), "👨‍💻  HUMAN AUDIENCE", font=f_tag, fill=CYAN)
d3.text((100, 460), "Interactive 3D WebGL (Three.js) & Visual BOQ", font=f_h3, fill=TEXT_WHITE)
d3.text((100, 520), "• 60 FPS spatial navigation through architectural models.", font=f_body, fill=TEXT_MUTED)
d3.text((100, 565), "• Detailed M-Book quantity takeoffs with DSR rate codes.", font=f_body, fill=TEXT_MUTED)
d3.text((100, 610), "• Designed for human visual cognitive comprehension.", font=f_body, fill=TEXT_MUTED)

# Agent Box
d3.rounded_rectangle([70, 715, W - 70, 1080], radius=20, fill=(15, 23, 42), outline=CYAN, width=2)
d3.rounded_rectangle([100, 745, 340, 790], radius=8, fill=(14, 116, 144))
d3.text((120, 755), "🤖  AI AGENT AUDIENCE", font=f_tag, fill=TEXT_WHITE)
d3.text((100, 815), "Programmatic Runtime Contract (window.__openbim_ai__)", font=f_h3, fill=CYAN)
d3.text((100, 875), "• element.__clarity_ai__.snapshot() returns clean JSON.", font=f_body, fill=TEXT_WHITE)
d3.text((100, 920), "• 96.2% Token Reduction: 320 tokens vs 8,500 raw DOM tokens.", font=f_body_bold, fill=EMERALD)
d3.text((100, 965), "• Exact, deterministic tool execution with zero visual scraping.", font=f_body, fill=TEXT_MUTED)
d3.text((100, 1010), "• Native function calling for Claude, Stagehand & LangGraph.", font=f_body, fill=TEXT_MUTED)

slides.append(img3)

# ==================== SLIDE 4: THE PERMISSION PROTOCOL ====================
img4, d4 = create_base_slide(4)
draw_top_pill(d4, "SECURITY PRIMITIVES", CYAN, bg=(15, 23, 42))

d4.text((70, 140), "The Clarity.js", font=f_title, fill=TEXT_WHITE)
d4.text((70, 215), "Permission Protocol", font=f_title, fill=CYAN)
d4.text((70, 300), "Declarative security boundaries declared directly in the component:", font=f_body, fill=TEXT_MUTED)

# Card 1: ai:readable
d4.rounded_rectangle([70, 360, W - 70, 570], radius=16, fill=(10, 30, 25), outline=EMERALD, width=2)
d4.text((105, 390), "🟢  ai:readable [Whitelisted State]", font=f_h3, fill=EMERALD)
d4.text((105, 445), "Safe data exposed to LLM context without token waste:", font=f_body, fill=TEXT_WHITE)
d4.text((105, 490), "Net concrete volumes (m³), rebar density (kg/m³), CPWD rates, Z-scores.", font=f_mono, fill=(167, 243, 208))

# Card 2: ai:actionable
d4.rounded_rectangle([70, 600, W - 70, 810], radius=16, fill=(15, 25, 45), outline=CYAN, width=2)
d4.text((105, 630), "🔵  ai:actionable [Whitelisted Tools]", font=f_h3, fill=CYAN)
d4.text((105, 685), "Approved functions the agent is permitted to execute:", font=f_body, fill=TEXT_WHITE)
d4.text((105, 730), "filterAnomalies(), recalibrateThresholds(), requestHITLSignoff().", font=f_mono, fill=(186, 230, 253))

# Card 3: ai:forbidden
d4.rounded_rectangle([70, 840, W - 70, 1070], radius=16, fill=(35, 15, 18), outline=CRIMSON, width=2)
d4.text((105, 870), "🔴  ai:forbidden [Zero-Trust Barrier]", font=f_h3, fill=CRIMSON)
d4.text((105, 925), "Safety-critical actions physically concealed from agents:", font=f_body, fill=TEXT_WHITE)
d4.text((105, 970), "overrideSafetyDefects(), modifyMasterLedger(), directDatabaseWrite().", font=f_mono, fill=(254, 202, 202))
d4.text((105, 1015), "Any violation triggers immediate security alarm and compliance audit log.", font=f_small, fill=TEXT_MUTED)

slides.append(img4)

# ==================== SLIDE 5: LIVE BREACH SIMULATION ====================
img5, d5 = create_base_slide(5)
draw_top_pill(d5, "LIVE INTERCEPTION", CRIMSON, bg=(35, 15, 15))

d5.text((70, 140), "Zero-Trust", font=f_title, fill=TEXT_WHITE)
d5.text((70, 215), "Security in Action", font=f_title, fill=CRIMSON)
d5.text((70, 300), "What happens when an autonomous agent attempts a rogue override?", font=f_body, fill=TEXT_MUTED)

# Sequence cards
steps = [
    ("Step 1", "Autonomous agent audits 163 members. Flags Column #16 (+22.4% concrete surge).", TEXT_WHITE),
    ("Step 2", "Agent attempts: contract.act('overrideSafetyDefects', { column: '#16' })", AMBER),
    ("Step 3", "⛔ RUNTIME FIREWALL BLOCKS ACTION: Policy violation logged with hash signature.", CRIMSON)
]

y_pos = 360
for s_num, s_desc, s_col in steps:
    d5.rounded_rectangle([70, y_pos, W - 70, y_pos + 120], radius=14, fill=CARD_BG, outline=CARD_BORDER, width=1)
    d5.rounded_rectangle([95, y_pos + 20, 200, y_pos + 60], radius=8, fill=(30, 41, 59))
    d5.text((115, y_pos + 28), s_num, font=f_tag, fill=CYAN)
    d5.text((95, y_pos + 70), s_desc, font=f_body_bold, fill=s_col)
    y_pos += 140

# Terminal Output Box
d5.rounded_rectangle([70, y_pos + 20, W - 70, 1080], radius=16, fill=(5, 8, 18), outline=CARD_BORDER, width=2)
d5.text((95, y_pos + 45), "TERMINAL SECURITY LOG", font=f_tag, fill=TEXT_DIM)
d5.text((95, y_pos + 85), "[SECURITY_VIOLATION] Actor: AUTONOMOUS_AGENT", font=f_mono, fill=CRIMSON)
d5.text((95, y_pos + 125), "Target: overrideSafetyDefects | Column: #16", font=f_mono, fill=TEXT_WHITE)
d5.text((95, y_pos + 165), "Verdict: BLOCKED by ai:forbidden policy firewall.", font=f_mono, fill=EMERALD)
d5.text((95, y_pos + 205), "Signature: sig_6dd00f01 | Logged to ISO 19650 audit trail.", font=f_mono, fill=CYAN)

slides.append(img5)

# ==================== SLIDE 6: HITL ====================
img6, d6 = create_base_slide(6)
draw_top_pill(d6, "HUMAN-IN-THE-LOOP", EMERALD, bg=(10, 30, 25))

d6.text((70, 140), "Autonomous AI +", font=f_title, fill=TEXT_WHITE)
d6.text((70, 215), "Certified Human Sign-Off", font=f_title, fill=EMERALD)
d6.text((70, 300), "Safe triage by AI, legally binding decisions by certified engineers:", font=f_body, fill=TEXT_MUTED)

# Flow Boxes
f_steps = [
    ("1", "Action Blocked by Firewall", "Agent attempt is quarantined; ticket created in HITL Queue."),
    ("2", "Certified Domain Review", "Chief Structural Auditor inspects bore log #4 and geotechnical survey."),
    ("3", "Cryptographic Sign-Off", "Engineer signs approval/rejection with tamper-evident digital signature.")
]

y_flow = 360
for num, title, desc in f_steps:
    d6.rounded_rectangle([70, y_flow, W - 70, y_flow + 140], radius=16, fill=CARD_BG, outline=CARD_BORDER, width=1)
    d6.rounded_rectangle([95, y_flow + 25, 145, y_flow + 75], radius=10, fill=EMERALD)
    d6.text((112, y_flow + 35), num, font=f_h3, fill=(11, 17, 32))
    d6.text((170, y_flow + 35), title, font=f_h3, fill=TEXT_WHITE)
    d6.text((170, y_flow + 85), desc, font=f_body, fill=TEXT_MUTED)
    y_flow += 165

# Verification Card
d6.rounded_rectangle([70, y_flow + 15, W - 70, 1080], radius=16, fill=(10, 35, 25), outline=EMERALD, width=2)
d6.text((105, y_flow + 40), "VERIFIED AUDIT STATUS: APPROVED", font=f_h3, fill=EMERALD)
d6.text((105, y_flow + 90), "Certifier: Er. Vikram Malhotra (Chief Structural Auditor)", font=f_body_bold, fill=TEXT_WHITE)
d6.text((105, y_flow + 130), "Justification: 'Site verification confirmed rock overbreak profile.'", font=f_body, fill=TEXT_MUTED)
d6.text((105, y_flow + 170), "Digital Hash: SHA-256 sig_6dd00f01 | ISO 19650 Compliant", font=f_mono, fill=CYAN)

slides.append(img6)

# ==================== SLIDE 7: EDGE VISION JETSON ====================
img7, d7 = create_base_slide(7)
draw_top_pill(d7, "EDGE ROBOTICS & MLOps", CYAN, bg=(15, 23, 42))

d7.text((70, 140), "Edge Computer Vision", font=f_title, fill=TEXT_WHITE)
d7.text((70, 215), "on NVIDIA Jetson", font=f_title, fill=CYAN)
d7.text((70, 300), "As-Designed (BIM) vs As-Built vision verification at 87 FPS:", font=f_body, fill=TEXT_MUTED)

# 3 Tech Stat Pills
stats = [
    ("87.4 FPS", "THROUGHPUT", CYAN),
    ("11.4 ms", "LATENCY", EMERALD),
    ("INT8", "QUANTIZATION", INDIGO)
]

x_box = 70
for val, lbl, col in stats:
    d7.rounded_rectangle([x_box, 360, x_box + 290, 480], radius=14, fill=CARD_BG, outline=CARD_BORDER, width=1)
    d7.text((x_box + 30, 385), val, font=f_h2, fill=col)
    d7.text((x_box + 30, 440), lbl, font=f_tag, fill=TEXT_MUTED)
    x_box += 325

# Description card
d7.rounded_rectangle([70, 520, W - 70, 850], radius=18, fill=CARD_BG, outline=CARD_BORDER, width=1)
d7.text((105, 560), "HARDWARE-ACCELERATED PIPELINE", font=f_tag, fill=CYAN)
d7.text((105, 605), "• Hardware: NVIDIA Jetson AGX Orin via TensorRT 10.3.", font=f_body_bold, fill=TEXT_WHITE)
d7.text((105, 655), "• Task: Drone 4K cameras segment rebar cover deficits and", font=f_body, fill=TEXT_MUTED)
d7.text((105, 695), "  formwork bulging, comparing live pours directly against IFC4.", font=f_body, fill=TEXT_MUTED)
d7.text((105, 745), "• Compliance: Enforces IS-456:2000 Table 16 mandatory cover limits.", font=f_body, fill=TEXT_MUTED)
d7.text((105, 785), "• Power Budget: 42W low-power edge profile for drone integration.", font=f_body, fill=TEXT_MUTED)

# Bottom Takeaway
d7.rounded_rectangle([70, 890, W - 70, 1070], radius=16, fill=(15, 23, 42), outline=INDIGO, width=2)
d7.text((105, 925), "CONTRACTUAL AUTOMATION:", font=f_tag, fill=INDIGO)
d7.text((105, 965), "Automatically synthesizes Non-Conformance Reports (NCR)", font=f_body_bold, fill=TEXT_WHITE)
d7.text((105, 1005), "with financial retention hold calculations ready for ERP billing.", font=f_body, fill=CYAN)

slides.append(img7)

# ==================== SLIDE 8: BENCHMARKS ====================
img8, d8 = create_base_slide(8)
draw_top_pill(d8, "EMPIRICAL BENCHMARKS", EMERALD, bg=(10, 30, 25))

d8.text((70, 140), "Production Results &", font=f_title, fill=TEXT_WHITE)
d8.text((70, 215), "Dispute Interception", font=f_title, fill=EMERALD)
d8.text((70, 300), "Validated against 4 real-world construction dispute datasets:", font=f_body, fill=TEXT_MUTED)

# 4 Stat Cards
stat_grid = [
    ("0.964", "ROC-AUC ACCURACY", "Deep Neural Autoencoders isolating multi-variable surges.", (70, 360, 520, 680), EMERALD),
    ("100%", "DISPUTES INTERCEPTED", "₹4.5 Lakhs in disputed contractor claims protected.", (560, 360, W - 70, 680), CYAN),
    ("96.2%", "TOKEN REDUCTION", "320 tokens vs 8,500 raw DOM tokens via Clarity.js contract.", (70, 715, 520, 1040), INDIGO),
    ("0", "MISSED CLAIMS", "Zero undetected volumetric surges across 163 members.", (560, 715, W - 70, 1040), AMBER)
]

for num, label, desc, bbox, col in stat_grid:
    d8.rounded_rectangle(bbox, radius=18, fill=CARD_BG, outline=CARD_BORDER, width=1)
    d8.text((bbox[0] + 30, bbox[1] + 35), num, font=f_stat_num, fill=col)
    d8.text((bbox[0] + 30, bbox[1] + 130), label, font=f_tag, fill=TEXT_WHITE)
    d8.text((bbox[0] + 30, bbox[1] + 175), desc, font=f_small, fill=TEXT_MUTED)

slides.append(img8)

# ==================== SLIDE 9: CALL TO ACTION ====================
img9, d9 = create_base_slide(9)
draw_top_pill(d9, "OPEN SOURCE & CONNECT", CYAN, bg=(15, 23, 42))

d9.text((70, 140), "Explore the Live Engine", font=f_title, fill=TEXT_WHITE)
d9.text((70, 215), "& Open Architecture", font=f_title, fill=CYAN)
d9.text((70, 300), "Everything is open source and deployed live for you to test:", font=f_body, fill=TEXT_MUTED)

# Link Card 1
d9.rounded_rectangle([70, 360, W - 70, 510], radius=16, fill=CARD_BG, outline=CYAN, width=2)
d9.text((105, 390), "🌐  LIVE WEB APPLICATION DEMO", font=f_tag, fill=CYAN)
d9.text((105, 435), "pravinkumardatafreak.github.io/openbim-boq-variance-engine/", font=f_body_bold, fill=TEXT_WHITE)

# Link Card 2
d9.rounded_rectangle([70, 540, W - 70, 690], radius=16, fill=CARD_BG, outline=CARD_BORDER, width=1)
d9.text((105, 570), "📦  GITHUB SOURCE REPOSITORY", font=f_tag, fill=INDIGO)
d9.text((105, 615), "github.com/pravinkumardatafreak/openbim-boq-variance-engine", font=f_body_bold, fill=TEXT_WHITE)

# Career Callout
d9.rounded_rectangle([70, 720, W - 70, 950], radius=18, fill=(15, 25, 45), outline=EMERALD, width=2)
d9.text((105, 755), "💼  OPEN TO NEW OPPORTUNITIES", font=f_tag, fill=EMERALD)
d9.text((105, 800), "Looking for Senior AI Engineer / Data Scientist roles:", font=f_h3, fill=TEXT_WHITE)
d9.text((105, 855), "• Computer Vision (TensorRT, Edge AI, Jetson, Segmentation)", font=f_body, fill=TEXT_MUTED)
d9.text((105, 895), "• Agentic AI & Governance (HITL, Function Calling, System Design)", font=f_body, fill=TEXT_MUTED)

# Bottom Sharing Actions
d9.rounded_rectangle([70, 985, W - 70, 1075], radius=14, fill=CARD_BG, outline=CARD_BORDER, width=1)
d9.text((105, 1015), "📌 Save for reference  •  🔁 Repost to your network  •  💬 Let's connect!", font=f_body_bold, fill=CYAN)

slides.append(img9)

# Save PDF & Individual PNGs
os.makedirs("docs/carousel_slides", exist_ok=True)
for i, slide in enumerate(slides):
    slide.save(f"docs/carousel_slides/slide_{i+1}.png")

pdf_path = "docs/OpenBIM_AI_Agent_Architecture_Carousel.pdf"
slides[0].save(pdf_path, save_all=True, append_images=slides[1:], resolution=150.0)
print(f"Successfully compiled {len(slides)} slides to {pdf_path}")
