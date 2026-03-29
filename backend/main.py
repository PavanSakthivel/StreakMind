from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import re
import random
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer

from planner import generate_study_plan
from focus_model import predict_focus, train_focus_model
from difficulty_model import predict_difficulty, train_difficulty_model
from database import db
from parser import extract_text_from_file

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
db.setdefault("materials", {})



app = FastAPI(title="StreakMind AI Study Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ─────────────────────────────────────────────────────────

class SyllabusInput(BaseModel):
    user_id: str
    subjects: List[str]
    topics: dict          # {"DAA": ["Greedy", "DP", ...], "Physics": [...]}
    exam_date: str        # "YYYY-MM-DD"
    daily_hours: float

class SessionData(BaseModel):
    user_id: str
    topic: str
    time_on_page: float
    idle_time: float
    click_count: int
    time_to_start: float
    previous_focus_score: float

class SessionFeedback(BaseModel):
    user_id: str
    topic: str
    time_taken: float
    difficulty_rating: str   # easy/medium/hard
    completed: bool
    focus_score: float
    accuracy: float

class UserProfile(BaseModel):
    user_id: str
    name: str

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "StreakMind AI Backend Running ✅"}

# User
@app.post("/api/user/create")
def create_user(profile: UserProfile):
    db["users"][profile.user_id] = {"name": profile.name, "streak": 0, "sessions": 0, "focus_score": 0.0}
    db_save()
    return {"status": "created", "user": db["users"][profile.user_id]}

@app.get("/api/user/{user_id}")
def get_user(user_id: str):
    user = db["users"].get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Planner
@app.post("/api/planner/generate")
def generate_plan(data: SyllabusInput):
    plan = generate_study_plan(
        subjects=data.subjects,
        topics=data.topics,
        exam_date=data.exam_date,
        daily_hours=data.daily_hours
    )
    db["plans"][data.user_id] = plan
    db_save()
    return {"user_id": data.user_id, "plan": plan}

@app.get("/api/planner/{user_id}/today")
def get_today_plan(user_id: str):
    plan = db["plans"].get(user_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found. Generate a plan first.")
    today_str = datetime.now().strftime("%Y-%m-%d")
    today_plan = plan.get(today_str, [])
    return {"date": today_str, "topics": today_plan}

@app.get("/api/planner/{user_id}/full")
def get_full_plan(user_id: str):
    plan = db["plans"].get(user_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found.")
    return {"plan": plan}

# Focus Prediction
@app.post("/api/session/predict-focus")
def predict_focus_endpoint(data: SessionData):
    features = {
        "time_on_page": data.time_on_page,
        "idle_time": data.idle_time,
        "click_count": data.click_count,
        "time_to_start": data.time_to_start,
        "previous_focus_score": data.previous_focus_score
    }
    result = predict_focus(features)
    return {"focused": result["focused"], "confidence": result["confidence"]}

# ─── Materials & Dynamic Questions ───────────────────────────────────────────

@app.post("/api/materials/upload")
async def upload_material(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    topic: str = Form(...)
):
    contents = await file.read()
    ext = file.filename.split('.')[-1].lower()
    
    db.setdefault("materials", {}).setdefault(user_id, {}).setdefault(topic, [])
    
    if ext in ['png', 'jpg', 'jpeg']:
        import uuid
        filepath = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        with open(filepath, "wb") as f:
            f.write(contents)
        db["materials"][user_id][topic].append(f"IMAGE:{filepath}")
    else:
        text = extract_text_from_file(contents, file.filename)
        if text.strip():
            db["materials"][user_id][topic].append(f"TEXT:{text}")
            
    db_save()
    return {"status": "success", "message": f"{file.filename} processed."}

@app.get("/api/session/question")
def get_dynamic_question(user_id: str, topic: str):
    materials = db.get("materials", {}).get(user_id, {}).get(topic, [])
    if not materials:
        raise HTTPException(status_code=404, detail="No materials found")

    full_text = ""
    for item in materials:
        if item.startswith("TEXT:"):
            full_text += item.split("TEXT:")[1] + " "
            
    if len(full_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Not enough text content")

    sentences = re.split(r'(?<=[.!?]) +', full_text.replace('\n', ' '))
    valid_sentences = [s.strip() for s in sentences if 30 < len(s) < 200]
    
    if len(valid_sentences) < 2:
        raise HTTPException(status_code=400, detail="Content too brief")

    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=30)
        vectorizer.fit_transform(valid_sentences)
        keywords = vectorizer.get_feature_names_out()
    except ValueError:
        raise HTTPException(status_code=400, detail="TF-IDF failed")
        
    if len(keywords) < 4:
         raise HTTPException(status_code=400, detail="Not enough keywords")

    random.shuffle(valid_sentences)
    chosen_sentence, chosen_keyword = None, None

    for sentence in valid_sentences:
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', sentence, re.IGNORECASE):
                chosen_sentence = sentence
                chosen_keyword = kw
                break
        if chosen_sentence:
            break

    if not chosen_sentence:
         raise HTTPException(status_code=400, detail="Could not formulate question")

    if random.choice(["mcq", "flashcard"]) == "mcq":
        pattern = re.compile(r'\b' + re.escape(chosen_keyword) + r'\b', re.IGNORECASE)
        question_text = pattern.sub("___________", chosen_sentence)
        
        options = [chosen_keyword]
        other_kws = [k for k in keywords if k != chosen_keyword]
        random.shuffle(other_kws)
        options.extend(other_kws[:3])
        random.shuffle(options)
        
        answer_idx = options.index(chosen_keyword)
        return {"type": "mcq", "question": question_text, "options": options, "answer": answer_idx}
    else:
        return {"type": "flashcard", "front": f"💡 Explain: {chosen_keyword}", "back": chosen_sentence}

# Session Feedback + Difficulty Recommendation

@app.post("/api/session/feedback")
def session_feedback(feedback: SessionFeedback):
    # Store session
    sessions = db["sessions"].setdefault(feedback.user_id, [])
    sessions.append({
        "topic": feedback.topic,
        "time_taken": feedback.time_taken,
        "difficulty_rating": feedback.difficulty_rating,
        "completed": feedback.completed,
        "focus_score": feedback.focus_score,
        "accuracy": feedback.accuracy,
        "timestamp": datetime.now().isoformat()
    })

    # Update streak & stats
    user = db["users"].setdefault(feedback.user_id, {"name": "Student", "streak": 0, "sessions": 0, "focus_score": 0.0})
    if feedback.completed:
        user["sessions"] = user.get("sessions", 0) + 1
        user["streak"] = user.get("streak", 0) + 1
    avg_focus = sum(s["focus_score"] for s in sessions) / len(sessions)
    user["focus_score"] = round(avg_focus, 2)

    # Predict next difficulty
    rec = predict_difficulty({
        "accuracy": feedback.accuracy,
        "time_taken": feedback.time_taken,
        "difficulty_rating": feedback.difficulty_rating,
        "focus_score": feedback.focus_score
    })
    db_save()
    return {
        "status": "recorded",
        "next_difficulty": rec["difficulty"],
        "streak": user["streak"],
        "sessions": user["sessions"],
        "avg_focus": user["focus_score"]
    }

# Train models (call once to initialize)
@app.post("/api/admin/train-models")
def train_models():
    focus_result = train_focus_model()
    diff_result = train_difficulty_model()
    return {"focus_model": focus_result, "difficulty_model": diff_result}

@app.get("/api/user/{user_id}/stats")
def get_stats(user_id: str):
    user = db["users"].get(user_id, {"streak": 0, "sessions": 0, "focus_score": 0.0, "name": "Student"})
    sessions = db["sessions"].get(user_id, [])
    return {
        "name": user.get("name", "Student"),
        "streak": user.get("streak", 0),
        "sessions_completed": user.get("sessions", 0),
        "avg_focus_score": user.get("focus_score", 0.0),
        "total_sessions": len(sessions)
    }

# ─── Persistence helpers ──────────────────────────────────────────────────────

DB_FILE = "data.json"

def db_save():
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

# Load on startup
if os.path.exists(DB_FILE):
    with open(DB_FILE) as f:
        loaded = json.load(f)
        db.update(loaded)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
