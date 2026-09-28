package service

import (
	"fmt"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
)

var unassignedReasonText = map[string]string{
	"no_engineer_with_required_skills": "нет инженера с нужными навыками и оборудованием",
	"time_window_conflict":             "работа не помещается во временное окно заявки или в смены инженеров",
	"overload":                         "все подходящие инженеры заняты более приоритетными заявками",
	"too_far":                          "адрес слишком далеко от маршрутов, инженеры не успевают доехать",
	"no_solution":                      "планировщик не нашёл допустимого плана для этого набора заявок",
	"unknown":                          "причина не определена планировщиком",
	reasonAddressNotFound:              "адрес не найден на карте",
}

func fillRuleExplanations(plan *dto.PlanResponse) {
	for i := range plan.Assigned {
		t := &plan.Assigned[i]
		if t.Explanation != "" {
			continue
		}

		t.Explanation = fmt.Sprintf(
			"Назначено инженеру %s: прибытие в %s",
			t.EngineerName, formatClock(t.ArrivalMin),
		)
		if start, end, ok := t.Window(); ok {
			t.Explanation += fmt.Sprintf(", окно %s–%s", formatClock(start), formatClock(end))
		}
		t.Explanation += "."
		if t.LateMin > 0 {
			t.Explanation += fmt.Sprintf(" Опоздание %d мин.", t.LateMin)
		}
	}

	for i := range plan.Unassigned {
		t := &plan.Unassigned[i]
		if t.Explanation != "" {
			continue
		}

		text, ok := unassignedReasonText[t.Reason]
		if !ok {
			text = t.Reason
		}
		t.Explanation = "Не назначено: " + text + "."
	}
}

func formatClock(minutes int) string {
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}
