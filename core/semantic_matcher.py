"""
Semantic Schedule of Rates (SOR) Matcher.
Replaces brittle regex lookups with vector space embeddings and n-gram cosine similarity
to map raw BIM material/specification strings to official CPWD DSR item codes.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from config.rates import DEFAULT_CONCRETE_RATES, STEEL_RATES, FORMWORK_RATES


class SemanticSORMatcher:
    """
    Vector search and cosine similarity engine over CPWD Delhi Schedule of Rates (DSR 2023).
    """

    def __init__(self):
        self.corpus_records: List[Dict[str, Any]] = []
        self._build_dsr_corpus()

        # Word + Character n-gram vectorizer handles both technical terminology and abbreviations/typos
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            sublinear_tf=True,
            lowercase=True,
        )
        descriptions = [r["text_for_embedding"] for r in self.corpus_records]
        self.corpus_matrix = self.vectorizer.fit_transform(descriptions)

    def _build_dsr_corpus(self):
        """Constructs rich text corpus from CPWD DSR schedule."""
        # 1. Concrete items
        for grade, data in DEFAULT_CONCRETE_RATES.items():
            if grade == "DEFAULT":
                continue
            text = f"Concrete {grade} RCC Design Mix ordinary portland cement {data['description']} {data['code']} structural grade {grade}"
            self.corpus_records.append({
                "item_code": data["code"],
                "category": "Concrete Works",
                "grade_tag": grade,
                "description": data["description"],
                "unit": data["unit"],
                "rate": data["rate"],
                "text_for_embedding": text,
            })

        # 2. Steel items
        text_steel = f"Steel reinforcement TMT Thermo-Mechanically Treated Fe-500D Fe-550 cutting bending binding {STEEL_RATES['description']} {STEEL_RATES['code']}"
        self.corpus_records.append({
            "item_code": STEEL_RATES["code"],
            "category": "Reinforcement Steel",
            "grade_tag": "Fe-500D",
            "description": STEEL_RATES["description"],
            "unit": STEEL_RATES["unit"],
            "rate": STEEL_RATES["rate_per_tonne"],
            "text_for_embedding": text_steel,
        })

        # 3. Formwork items
        for ifc_class, data in FORMWORK_RATES.items():
            if ifc_class == "DEFAULT":
                continue
            member_name = ifc_class.replace("Ifc", "")
            text_fw = f"Centering and shuttering formwork staging propping {member_name} {data['description']} {data['code']}"
            self.corpus_records.append({
                "item_code": data["code"],
                "category": "Centering & Shuttering",
                "grade_tag": member_name,
                "description": data["description"],
                "unit": data["unit"],
                "rate": data["rate"],
                "text_for_embedding": text_fw,
            })

    def match_specification(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Computes cosine similarity between query string and CPWD schedule items.
        Returns top-k ranked matches with confidence percentages.
        """
        if not query or not query.strip():
            return []

        q_vec = self.vectorizer.transform([query.strip()])
        similarities = cosine_similarity(q_vec, self.corpus_matrix)[0]

        top_indices = np.argsort(similarities)[::-1][:top_k]

        matches = []
        for idx in top_indices:
            score = float(similarities[idx])
            rec = self.corpus_records[idx]
            matches.append({
                "item_code": rec["item_code"],
                "category": rec["category"],
                "specification": rec["description"],
                "grade_tag": rec["grade_tag"],
                "unit": rec["unit"],
                "base_rate_inr": rec["rate"],
                "similarity_score": round(score, 4),
                "confidence_pct": round(score * 100.0, 1),
                "match_tier": "Exact / Strong" if score > 0.55 else ("Probable" if score > 0.30 else "Weak"),
            })

        return matches
