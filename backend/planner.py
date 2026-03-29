from datetime import datetime, timedelta
from typing import List, Dict

def generate_study_plan(
    subjects: List[str],
    topics: Dict[str, List[str]],
    exam_date: str,
    daily_hours: float
) -> Dict[str, List[dict]]:
    """
    Generate a day-by-day study plan from today until exam_date.
    Distributes topics evenly across available days.
    Returns: { "YYYY-MM-DD": [{"subject": ..., "topic": ..., "duration_min": ...}] }
    """
    today = datetime.now().date()
    exam = datetime.strptime(exam_date, "%Y-%m-%d").date()
    days_left = (exam - today).days

    if days_left <= 0:
        return {"error": "Exam date must be in the future"}

    # Flatten all topics with their subject
    all_topics = []
    for subject in subjects:
        for topic in topics.get(subject, []):
            all_topics.append({"subject": subject, "topic": topic})

    if not all_topics:
        return {}

    # Calculate duration per topic
    total_minutes = daily_hours * 60
    topics_per_day = max(1, len(all_topics) // days_left)
    minutes_per_topic = round(total_minutes / topics_per_day)

    plan = {}
    topic_index = 0

    for day_offset in range(days_left):
        date_str = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        day_topics = []

        for _ in range(topics_per_day):
            if topic_index >= len(all_topics):
                break
            t = all_topics[topic_index].copy()
            t["duration_min"] = minutes_per_topic
            day_topics.append(t)
            topic_index += 1

        if day_topics:
            plan[date_str] = day_topics

    # If topics remain, append them to the last day
    while topic_index < len(all_topics):
        last_date = list(plan.keys())[-1] if plan else today.strftime("%Y-%m-%d")
        t = all_topics[topic_index].copy()
        t["duration_min"] = minutes_per_topic
        plan.setdefault(last_date, []).append(t)
        topic_index += 1

    return plan
