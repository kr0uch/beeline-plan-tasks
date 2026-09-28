package repository

import (
	"context"
	"encoding/csv"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const (
	durationGigabitBonus = 30
	durationFTTBBonus    = 15
	durationMin          = 25
	durationMax          = 180
	defaultBaseDuration  = 60
)

var durationPriors = map[string]int{
	"подключение":         60,
	"дозаказ":             45,
	"локальная заявка":    30,
	"локальная":           30,
	"глобальная проблема": 60,
	"глобальная":          60,

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

type TaskRepository interface {
	ParseTasksFromCSV(
		ctx context.Context,
		reader io.Reader,
	) ([]*entities.Task, error)
}

type taskRepo struct{}

func NewTaskRepository() TaskRepository {
	return &taskRepo{}
}

func (r *taskRepo) ParseTasksFromCSV(
	ctx context.Context,
	reader io.Reader,
) ([]*entities.Task, error) {

	csvReader := csv.NewReader(reader)
	csvReader.Comma = ';'
	csvReader.FieldsPerRecord = -1

	header, err := csvReader.Read()
	if err != nil {
		return nil, errors.ErrInvalidCSVHeaders
	}

	colIndex := make(map[string]int)
	for i, col := range header {
		colIndex[strings.TrimSpace(col)] = i
	}

	var tasks []*entities.Task

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.ErrInvalidCSVRow(err.Error())
		}

		if len(record) == 0 || record[0] == "" {
			continue
		}

		taskID, err := strconv.Atoi(strings.TrimSpace(getCol(record, colIndex, "Заявка")))
		if err != nil {
			continue
		}

		twStartMin := parseTimeToMinutes(getCol(record, colIndex, "Начало"))
		twEndMin := parseTimeToMinutes(getCol(record, colIndex, "Окончание"))

		typeBK := getCol(record, colIndex, "Тип заявки BK")
		typeHD := getCol(record, colIndex, "Тип заявки HD")
		connection := getCol(record, colIndex, "Подключение")
		gigabit := getCol(record, colIndex, "Гигабитное подключение")
		district := getCol(record, colIndex, "Район")

		task := &entities.Task{
			ID:                taskID,
			TypeBK:            typeBK,
			TypeHD:            typeHD,
			District:          getCol(record, colIndex, "Район"),
			Address:           getCol(record, colIndex, "Адрес"),
			TWStart:           twStartMin,
			TWEnd:             twEndMin,
			ServiceTime:       calculateServiceTime(typeBK, typeHD, connection),
			RequiredSkills:    extractSkills(typeBK, typeHD, connection, gigabit),
			RequiredEquipment: extractEquipments(typeBK, typeHD, connection, gigabit, district),
		}

		tasks = append(tasks, task)
	}

	return tasks, nil
}

func getCol(
	record []string,
	colIndex map[string]int,
	colName string,
) string {

	idx, ok := colIndex[colName]
	if !ok || idx >= len(record) {
		return ""
	}

	return strings.TrimSpace(record[idx])
}

const defaultStartTime = 540

func parseTimeToMinutes(timeStr string) int {
	layout := "02.01.2006 15:04"
	t, err := time.Parse(layout, timeStr)
	if err != nil {
		return defaultStartTime
	}

	return t.Hour()*60 + t.Minute()
}

func extractEquipments(typeBK, typeHD, connection, gigabit, district string) []entities.Equipment {
	equipSet := make(map[entities.Equipment]bool)

	bkLower := strings.ToLower(strings.TrimSpace(typeBK))
	hdLower := strings.ToLower(strings.TrimSpace(typeHD))
	connLower := strings.ToLower(strings.TrimSpace(connection))
	gigabitLower := strings.ToLower(strings.TrimSpace(gigabit))
	districtLower := strings.ToLower(strings.TrimSpace(district))

	if bkLower == "подключение" ||
		strings.Contains(hdLower, "роутер") ||
		strings.Contains(hdLower, "дозаказ") {
		equipSet[entities.RouterEq] = true
	}

	if connLower == "fmc" ||
		strings.Contains(hdLower, "конвергенция") ||
		strings.Contains(hdLower, "тв") ||
		strings.Contains(hdLower, "tve") ||
		strings.Contains(hdLower, "ent") {
		equipSet[entities.TvBoxEq] = true
	}

	if gigabitLower == "да" || strings.Contains(hdLower, "гбит") {
		equipSet[entities.GigabitKitEq] = true
	}

	if strings.Contains(districtLower, "gpon") ||
		strings.Contains(connLower, "gpon") ||
		strings.Contains(connLower, "pon") ||
		strings.Contains(connLower, "оптик") {
		equipSet[entities.OpticsKitEq] = true
	}

	if connLower == "fttb" ||
		bkLower == "подключение" ||
		bkLower == "локальная заявка" ||
		bkLower == "глобальная проблема" ||
		strings.Contains(hdLower, "кабел") ||
		strings.Contains(hdLower, "линк") ||
		strings.Contains(hdLower, "разрыв") ||
		strings.Contains(hdLower, "авария") ||
		strings.Contains(hdLower, "ошибок") ||
		strings.Contains(hdLower, "скорость") ||
		strings.Contains(hdLower, "169") {
		equipSet[entities.CableKitEq] = true
	}

	equipments := make([]entities.Equipment, 0, len(equipSet))
	for eq := range equipSet {
		equipments = append(equipments, eq)
	}

	return equipments
}

func extractSkills(typeBK, typeHD, connection, gigabit string) []entities.Skill {
	skillSet := map[entities.Skill]bool{
		entities.BasicSkill: true,
	}

	bkLower := strings.ToLower(strings.TrimSpace(typeBK))
	hdLower := strings.ToLower(strings.TrimSpace(typeHD))
	connLower := strings.ToLower(strings.TrimSpace(connection))
	gigabitLower := strings.ToLower(strings.TrimSpace(gigabit))

	if connLower == "fmc" || strings.Contains(hdLower, "конвергенция") {
		skillSet[entities.FMCSkill] = true
	}

	if strings.Contains(bkLower, "глобальн") || strings.Contains(hdLower, "авария") {
		skillSet[entities.EmergencySkill] = true
	}

	if gigabitLower == "да" || strings.Contains(hdLower, "гбит") {
		skillSet[entities.GigabitSkill] = true
	}

	if connLower == "fttb" {
		skillSet[entities.FTTBSkill] = true
	}

	skills := make([]entities.Skill, 0, len(skillSet))
	for s := range skillSet {
		skills = append(skills, s)
	}

	return skills
}

func calculateServiceTime(typeBK, typeHD, connection string) int {
	bkLower := strings.ToLower(strings.TrimSpace(typeBK))
	hdLower := strings.ToLower(strings.TrimSpace(typeHD))
	connLower := strings.ToLower(strings.TrimSpace(connection))

	base := defaultBaseDuration
	switch {
	case strings.Contains(bkLower, "дозаказ"):
		base = durationPriors["дозаказ"]
	case strings.Contains(bkLower, "локальн"):
		base = durationPriors["локальная"]
	case strings.Contains(bkLower, "глобальн"):
		base = durationPriors["глобальная"]
	case strings.Contains(bkLower, "подключени"):
		base = durationPriors["подключение"]
	default:
		if val, ok := durationPriors[bkLower]; ok {
			base = val
		}
	}

	modifier := 0
	for key, val := range durationPriors {
		if key == "подключение" || key == "дозаказ" ||
			key == "локальная" || key == "локальная заявка" ||
			key == "глобальная" || key == "глобальная проблема" {
			continue
		}
		if strings.Contains(hdLower, key) {
			modifier += val
		}
	}

	bonuses := 0
	if strings.Contains(connLower, "гбит") || strings.Contains(connLower, "gigabit") ||
		strings.Contains(hdLower, "гбит") || strings.Contains(hdLower, "gigabit") {
		bonuses += durationGigabitBonus
	}

	if strings.Contains(connLower, "fttb") || strings.Contains(connLower, "фттб") {
		bonuses += durationFTTBBonus
	}

	total := base + modifier + bonuses

	if total < durationMin {
		return durationMin
	}
	if total > durationMax {
		return durationMax
	}

	return total
}
