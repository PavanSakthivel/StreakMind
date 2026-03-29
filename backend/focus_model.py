"""
Focus Model – Logistic Regression
Features: time_on_page, idle_time, click_count, time_to_start, previous_focus_score
Label: 1 = focused, 0 = distracted
"""

import numpy as np
import os
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

MODEL_PATH = "focus_model.pkl"

# ─── Synthetic training data generator ──────────────────────────────────────

def _generate_training_data(n=500):
    np.random.seed(42)
    X, y = [], []

    for _ in range(n):
        time_on_page = np.random.uniform(60, 600)
        idle_time = np.random.uniform(0, 300)
        click_count = np.random.randint(0, 50)
        time_to_start = np.random.uniform(0, 120)
        prev_focus = np.random.uniform(0, 1)

        # Rule-based labeling
        distracted = (
            idle_time > 60 or
            click_count < 2 or
            time_to_start > 60 or
            prev_focus < 0.3
        )
        label = 0 if distracted else 1

        X.append([time_on_page, idle_time, click_count, time_to_start, prev_focus])
        y.append(label)

    return np.array(X), np.array(y)


# ─── Train ───────────────────────────────────────────────────────────────────

def train_focus_model():
    X, y = _generate_training_data(n=600)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000, random_state=42))
    ])
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    # Quick accuracy check
    preds = model.predict(X)
    acc = np.mean(preds == y)
    return {"status": "trained", "accuracy": round(float(acc), 4), "samples": len(y)}


# ─── Predict ─────────────────────────────────────────────────────────────────

def _load_model():
    if not os.path.exists(MODEL_PATH):
        train_focus_model()
    return joblib.load(MODEL_PATH)


def predict_focus(features: dict) -> dict:
    """
    features: {time_on_page, idle_time, click_count, time_to_start, previous_focus_score}
    Returns: {focused: bool, confidence: float}
    """
    model = _load_model()
    X = np.array([[
        features["time_on_page"],
        features["idle_time"],
        features["click_count"],
        features["time_to_start"],
        features["previous_focus_score"]
    ]])
    pred = int(model.predict(X)[0])
    proba = model.predict_proba(X)[0]
    confidence = round(float(max(proba)), 3)
    return {"focused": pred == 1, "confidence": confidence}
