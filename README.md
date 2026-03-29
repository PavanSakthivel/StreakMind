# ⚡ StreakMind AI – Smart Study Engine

A college syllabus-based study planner with **real-time focus tracking**, **ML-based adaptation**, and **AI Document Quizzes**.

---

## 🗂️ Project Structure

```
streakmind/
├── backend/
│   ├── main.py              ← FastAPI server (all routes)
│   ├── planner.py           ← Study plan generation logic
│   ├── parser.py            ← Document parsing for AI Quizzes
│   ├── focus_model.py       ← Logistic Regression focus prediction
│   ├── difficulty_model.py  ← Decision Tree difficulty recommendation
│   ├── database.py          ← In-memory DB (persisted to data.json)
│   ├── requirements.txt     ← Python dependencies
│   └── uploads/             ← User uploaded documents
│
└── frontend/
    ├── index.html           ← Main application structure
    ├── app.js               ← Vanilla JS logic & API calls
    └── style.css            ← Custom styling
```

---

## 🚀 Running the Project Locally

### Prerequisites
- **Python 3.9+**

---

### Step 1 – Start the Backend

```bash
cd streakmind/backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be live at: **http://localhost:8000**
You can explore endpoints and Swagger UI at: **http://localhost:8000/docs**

---

### Step 2 – Start the Frontend

The frontend is built with pure HTML/CSS/JS and requires no build step.

To run it, you can use any static file server. For example:
```bash
cd streakmind/frontend

# Using Python's built-in HTTP server
python -m http.server 3000
```

Alternatively, you can use the **Live Server** extension in VS Code.
Open your browser to: **http://localhost:3000**

---

## 🧠 Machine Learning & AI

### 1. Document AI Quizzes (TF-IDF)
- **Feature:** Upload PDFs, PPTX, TXT, or Image files.
- **Logic:** Extracts text using `PyPDF2` and `python-pptx`, then processes it using a local TF-IDF vectorizer via `scikit-learn` to extract essential keywords and dynamically generate fill-in-the-blank or MCQ questions matching the document content.

### 2. Focus Prediction (Logistic Regression)
- **Features:** `time_on_page`, `idle_time`, `click_count`, `time_to_start`, `previous_focus_score`
- **Label:** 1 = focused, 0 = distracted
- **Trigger:** Evaluated during the timer session.
- **File:** `focus_model.pkl`

### 3. Difficulty Recommendation (Decision Tree)
- **Features:** `accuracy`, `time_taken`, `difficulty_rating`, `focus_score`
- **Output:** easy / medium / hard
- **File:** `difficulty_model.pkl`

> Models are trained locally based on user data and logic. To manually retrain: `POST http://localhost:8000/api/admin/train-models`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/create` | Create a user profile |
| GET | `/api/user/{id}/stats` | Get user stats & streaks |
| POST | `/api/planner/generate` | Generate study plan |
| GET | `/api/planner/{id}/today` | Get today's topics |
| POST | `/api/session/predict-focus` | ML focus prediction |
| POST | `/api/session/feedback` | Log session + get difficulty rec |
| POST | `/api/admin/train-models` | Retrain ML models |
| POST | `/api/upload-material` | Upload study document for parsing |
| GET | `/api/generate-quiz/{filename}`| Generate AI quiz from uploaded document |

---

## 🧩 Feature Flow

```
1. User enters name → Profile created
2. Add subjects + topics + exam date
3. System distributes topics day-by-day
4. Upload files (PDF/PPTX/TXT/Images) for an AI generated quiz context
5. Start a study session (timer-based)
6. Real-time: ML model predicts focus based on input
7. If distracted → Intervention pops up
8. Session ends → user gives feedback, quiz questions evaluated
9. Decision Tree recommends next learning difficulty
10. Streak + focus score updated
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript, HTML5, CSS |
| Backend | Python, FastAPI |
| Machine Learning | scikit-learn (LogisticRegression, DecisionTree, TF-IDF) |
| Document Parsing | PyPDF2, python-pptx |
| Storage | JSON file (`data.json`) |

---

## 📝 Notes

- Data is saved to `backend/data.json` automatically.
- Uploaded files are securely processed in `backend/uploads/`.
- ML models are saved as `.pkl` files.
- No external database or LLM API keys required — everything runs 100% locally and offline!
- To reset user data: delete `backend/data.json`.
