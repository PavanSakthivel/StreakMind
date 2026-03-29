"""
Difficulty Model – Decision Tree Classifier
Features: accuracy, time_taken, difficulty_rating, focus_score
Output: easy / medium / hard
"""

import numpy as np
import os
import joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder

MODEL_PATH = "difficulty_model.pkl"
ENCODER_PATH = "difficulty_encoder.pkl"

DIFFICULTY_MAP = {"easy": 0, "medium": 1, "hard": 2}
REVERSE_MAP = {0: "easy", 1: "medium", 2: "hard"}

# ─── Synthetic training data ─────────────────────────────────────────────────

def _generate_training_data(n=600):
    np.random.seed(7)
    X, y = [], []

    for _ in range(n):
        accuracy = np.random.uniform(0, 1)
        time_taken = np.random.uniform(1, 60)       # minutes
        diff_raw = np.random.choice([0, 1, 2])       # easy/medium/hard
        focus_score = np.random.uniform(0, 1)

        # Rules for next difficulty
        if accuracy > 0.8 and focus_score > 0.7:
            next_diff = min(diff_raw + 1, 2)         # go harder
        elif accuracy < 0.4 or focus_score < 0.3:
            next_diff = max(diff_raw - 1, 0)         # go easier
        else:
            next_diff = diff_raw                     # stay same

        X.append([accuracy, time_taken, diff_raw, focus_score])
        y.append(next_diff)

    return np.array(X), np.array(y)


# ─── Train ───────────────────────────────────────────────────────────────────

def train_difficulty_model():
    X, y = _generate_training_data(n=600)

    model = DecisionTreeClassifier(max_depth=5, random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    preds = model.predict(X)
    acc = np.mean(preds == y)
    return {"status": "trained", "accuracy": round(float(acc), 4), "samples": len(y)}


# ─── Predict ─────────────────────────────────────────────────────────────────

def _load_model():
    if not os.path.exists(MODEL_PATH):
        train_difficulty_model()
    return joblib.load(MODEL_PATH)


def predict_difficulty(features: dict) -> dict:
    """
    features: {accuracy, time_taken, difficulty_rating (str), focus_score}
    Returns: {difficulty: "easy"|"medium"|"hard"}
    """
    model = _load_model()
    diff_num = DIFFICULTY_MAP.get(features.get("difficulty_rating", "medium"), 1)
    X = np.array([[
        features["accuracy"],
        features["time_taken"],
        diff_num,
        features["focus_score"]
    ]])
    pred = int(model.predict(X)[0])
    return {"difficulty": REVERSE_MAP.get(pred, "medium")}
