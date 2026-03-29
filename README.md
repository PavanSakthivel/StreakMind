# ⚡ StreakMind AI – Smart Study Engine

A college syllabus-based study planner with **real-time focus tracking** and **ML-based adaptation**.

---

## 🗂️ Project Structure

```
streakmind/
├── backend/
│   ├── main.py              ← FastAPI server (all routes)
│   ├── planner.py           ← Study plan generation logic
│   ├── focus_model.py       ← Logistic Regression focus prediction
│   ├── difficulty_model.py  ← Decision Tree difficulty recommendation
│   ├── database.py          ← In-memory DB (persisted to data.json)
│   └── requirements.txt
│
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.jsx
        ├── index.js
        ├── index.css
        └── pages/
            ├── Setup.jsx          ← Onboarding
            ├── Dashboard.jsx      ← Stats & today's plan
            ├── Planner.jsx        ← Syllabus input + plan view
            └── StudySession.jsx   ← Timer, focus tracking, intervention
```

---

## 🚀 Running the Project Locally

### Prerequisites
- **Python 3.9+**
- **Node.js 18+** and npm

---

### Step 1 – Start the Backend

```bash
cd streakmind/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

The API will be live at: **http://localhost:8000**

You can explore endpoints at: **http://localhost:8000/docs**

---

### Step 2 – Start the Frontend

```bash
cd streakmind/frontend

# Install dependencies
npm install

# Start dev server
npm start
```

The app will open at: **http://localhost:3000**

---

## 🧠 Machine Learning Models

### Model 1: Focus Prediction (Logistic Regression)
- **Features:** `time_on_page`, `idle_time`, `click_count`, `time_to_start`, `previous_focus_score`
- **Label:** 1 = focused, 0 = distracted
- **Trigger:** Models are auto-trained on first user creation
- **File:** `focus_model.pkl`

### Model 2: Difficulty Recommendation (Decision Tree)
- **Features:** `accuracy`, `time_taken`, `difficulty_rating`, `focus_score`
- **Output:** easy / medium / hard
- **File:** `difficulty_model.pkl`

> Models are trained on synthetic data and retrained as you use the app.
> To manually retrain: `POST http://localhost:8000/api/admin/train-models`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/create` | Create a user profile |
| GET | `/api/user/{id}/stats` | Get user stats & streaks |
| POST | `/api/planner/generate` | Generate study plan |
| GET | `/api/planner/{id}/today` | Get today's topics |
| GET | `/api/planner/{id}/full` | Get full study plan |
| POST | `/api/session/predict-focus` | ML focus prediction |
| POST | `/api/session/feedback` | Log session + get difficulty rec |
| POST | `/api/admin/train-models` | Retrain ML models |

---

## 🧩 Feature Flow

```
1. User enters name → Profile created
2. Add subjects + topics + exam date
3. System distributes topics day-by-day
4. Start a study session (timer-based)
5. Every 60s: ML model predicts focus
6. If distracted → MCQ/flashcard intervention
7. Session ends → user gives feedback
8. Decision Tree recommends next difficulty
9. Streak + focus score updated
```

---

## ⚙️ Configuration

Edit `frontend/src/App.jsx` to change the API base URL:
```js
const API = 'http://localhost:8000';
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Axios |
| Backend | Python, FastAPI |
| ML | scikit-learn (LogisticRegression, DecisionTree) |
| Storage | JSON file (upgradeable to MongoDB) |
| Styling | Custom CSS with CSS variables |

---

## 📝 Notes

- Data is saved to `backend/data.json` automatically
- ML models are saved as `.pkl` files in `backend/`
- No external database required — runs 100% locally
- To reset user data: delete `backend/data.json`
