package repository

import (
	"context"
	"io"
	"slices"
	"strconv"
	"strings"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const taskTimeLayout = "02.01.2006 15:04"

var requiredTaskColumns = []string{"Заявка", "Начало", "Окончание", "Адрес"}

const (
	durationDefaultBase  = 60
	durationGigabitBonus = 30
	durationFTTBBonus    = 15
	durationMin          = 25
	durationMax          = 180
)

var durationBaseByBK = []struct {
	marker  string
	minutes int
}{
	{"дозаказ", 45},
	{"локальн", 30},
	{"глобальн", 60},
	{"подключени", 60},
}

var durationModifierByHD = map[string]int{
	"конвергенция абонента":                  0,
	"заявка на подключение":                  -10,
	"заказ подключения/дозаказ оборудования": 15,
	"дозаказ оборудования":                   0,
	"нет линка":        0,
	"разрывы":          10,
	"работа с кабелем": 20,
	"роутер. замена техническим специалистом": 15,
	"tve/ent. другие ошибки":                  10,
	"tve/ent. замена приставки техником":      10,
	"тв. замена приставки техником":           10,
	"переключение на гбит/с":                  20,
	"ip-адрес 169...":                         10,
	"рост ошибок на порту":                    10,
	"низкая скорость":                         10,
	"мониторинг":                              -10,
	"информация":                              -20,
	"авария":                                  40,
}

type TaskRepo struct{}

func NewTaskRepository() *TaskRepo {
	return &TaskRepo{}
}

func (r *TaskRepo) ParseTasksFromCSV(
	ctx context.Context,
	reader io.Reader,
) ([]*entities.Task, error) {

	rows, err := newCSVRows(reader)
	if err != nil {
		return nil, errors.ErrInvalidTasksCSVHeader(err.Error())
	}
	if missing := rows.missingColumns(requiredTaskColumns); len(missing) > 0 {
		return nil, errors.ErrInvalidTasksCSVHeader("missing: " + strings.Join(missing, ", "))
	}

	var tasks []*entities.Task
	for {
		row, err := rows.next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.ErrInvalidTaskRow(err.Error())
		}

		task, err := parseTaskRow(row)
		if err != nil {
			return nil, err
		}
		if task != nil {
			tasks = append(tasks, task)
		}
	}
	if len(tasks) == 0 {
		return nil, errors.ErrNoTasksInCSV
	}

	return tasks, nil
}

func parseTaskRow(row csvRow) (*entities.Task, error) {
	id, err := strconv.Atoi(row.get("Заявка"))
	if err != nil {
		return nil, nil
	}

	twStart, err := parseClockToMinutes(row.get("Начало"), taskTimeLayout)
	if err != nil {
		return nil, errors.ErrInvalidTaskRow(row.errorf("invalid window start %q", row.get("Начало")))
	}

	twEnd, err := parseClockToMinutes(row.get("Окончание"), taskTimeLayout)
	if err != nil {
		return nil, errors.ErrInvalidTaskRow(row.errorf("invalid window end %q", row.get("Окончание")))
	}

	attrs := newTaskAttributes(
		row.get("Тип заявки BK"),
		row.get("Тип заявки HD"),
		row.get("Подключение"),
		row.get("Гигабитное подключение"),
		row.get("Район"),
	)

	skills := attrs.requiredSkills()
	equipment := attrs.requiredEquipment()

	return &entities.Task{
		ID:                id,
		TypeBK:            row.get("Тип заявки BK"),
		TypeHD:            row.get("Тип заявки HD"),
		District:          row.get("Район"),
		Address:           row.get("Адрес"),
		TWStart:           twStart,
		TWEnd:             twEnd,
		ServiceTime:       attrs.serviceTime(skills, equipment),
		RequiredSkills:    skills,
		RequiredEquipment: equipment,
	}, nil
}

type taskAttributes struct {
	typeBK     string
	typeHD     string
	connection string
	gigabit    bool
	district   string
}

func newTaskAttributes(typeBK, typeHD, connection, gigabit, district string) taskAttributes {
	return taskAttributes{
		typeBK:     strings.ToLower(typeBK),
		typeHD:     strings.ToLower(typeHD),
		connection: strings.ToLower(connection),
		gigabit:    strings.EqualFold(gigabit, "да") || strings.Contains(strings.ToLower(typeHD), "гбит"),
		district:   strings.ToLower(district),
	}
}

func (a taskAttributes) hdContainsAny(markers ...string) bool {
	return slices.ContainsFunc(markers, func(m string) bool {
		return strings.Contains(a.typeHD, m)
	})
}

func (a taskAttributes) requiredSkills() []entities.Skill {
	skills := []entities.Skill{entities.BasicSkill}

	if a.connection == "fmc" || a.hdContainsAny("конвергенция") {
		skills = append(skills, entities.FMCSkill)
	}
	if strings.Contains(a.typeBK, "глобальн") || a.hdContainsAny("авария") {
		skills = append(skills, entities.EmergencySkill)
	}
	if a.gigabit {
		skills = append(skills, entities.GigabitSkill)
	}
	if a.connection == "fttb" {
		skills = append(skills, entities.FTTBSkill)
	}

	return skills
}

func (a taskAttributes) requiredEquipment() []entities.Equipment {
	equipment := make([]entities.Equipment, 0)

	if a.typeBK == "подключение" || a.hdContainsAny("роутер", "дозаказ") {
		equipment = append(equipment, entities.RouterEq)
	}

	if a.connection == "fmc" || a.hdContainsAny("конвергенция", "тв", "tve", "ent") {
		equipment = append(equipment, entities.TvBoxEq)
	}

	if a.gigabit {
		equipment = append(equipment, entities.GigabitKitEq)
	}

	if strings.Contains(a.district, "gpon") ||
		strings.Contains(a.connection, "pon") ||
		strings.Contains(a.connection, "оптик") {
		equipment = append(equipment, entities.OpticsKitEq)
	}

	if a.connection == "fttb" ||
		a.typeBK == "подключение" ||
		a.typeBK == "локальная заявка" ||
		a.typeBK == "глобальная проблема" ||
		a.hdContainsAny("кабел", "линк", "разрыв", "авария", "ошибок", "скорость", "169") {
		equipment = append(equipment, entities.CableKitEq)
	}

	return equipment
}

func (a taskAttributes) serviceTime(
	skills []entities.Skill,
	equipment []entities.Equipment,
) int {

	total := durationDefaultBase
	for _, base := range durationBaseByBK {
		if strings.Contains(a.typeBK, base.marker) {
			total = base.minutes
			break
		}
	}

	for marker, minutes := range durationModifierByHD {
		if strings.Contains(a.typeHD, marker) {
			total += minutes
		}
	}

	if slices.Contains(equipment, entities.GigabitKitEq) {
		total += durationGigabitBonus
	}
	if slices.Contains(skills, entities.FTTBSkill) {
		total += durationFTTBBonus
	}

	return min(max(total, durationMin), durationMax)
}
