from __future__ import annotations
import os
import requests


def _template_digest(route, assigned_for_eng):
    lines = [f"Маршрут для {route['engineer_name']}:"]
    lines.append(f"  Пробег: {route['distance_km']} км, время: {route['time_min']} мин")
    for i, a in enumerate(assigned_for_eng, 1):
        h = a['arrival_min'] // 60; m = a['arrival_min'] % 60
        lines.append(f"  {i}. {h:02d}:{m:02d} — заявка #{a['task_id']} ({a['priority']})")
    return "\n".join(lines)


def llm_digest(route, assigned_for_eng, provider="yandex"):
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        return _template_digest(route, assigned_for_eng)

    prompt = (
        f"Ты диспетчер. Составь краткий текст для инженера {route['engineer_name']}. "
        f"Формат: 'В HH:MM выезд к X, задача #ID, приоритет Y'. "
        f"Данные: {assigned_for_eng}"
    )
    try:
        if provider == "yandex":
            r = requests.post(
                "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
                headers={"Authorization": f"Api-Key {api_key}"},
                json={"modelUri": "gpt://b1g/yandexgpt-lite",
                      "completionOptions": {"temperature": 0.3, "maxTokens": 500},
                      "messages": [{"role": "user", "text": prompt}]},
                timeout=15,
            )
            r.raise_for_status()
            return r.json()["result"]["alternatives"][0]["message"]["text"]
    except Exception:
        pass
    return _template_digest(route, assigned_for_eng)