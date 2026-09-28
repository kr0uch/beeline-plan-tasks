package repository

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type EngineerRepository interface {
	ParseEngineersFromCSV(
		ctx context.Context,
		reader io.Reader,
	) ([]*entities.Engineer, error)
	ParseEngineersFromCSVByRegion(
		ctx context.Context,
		region string,
	) ([]*entities.Engineer, error)
	GetEngineersMapByIDAndRegion(
		ctx context.Context,
		region string,
	) (map[string]*entities.Engineer, error)
	SaveEngineersToCSVByRegion(
		ctx context.Context,
		region string,
		engineers []*entities.Engineer,
	) error
}

type engineerRepo struct {
	engineersDirectory string
}

func NewEngineerRepository(
	engineersDirectory string,
) EngineerRepository {
	return &engineerRepo{
		engineersDirectory: fmt.Sprintf("%sengineers_%%s.csv", engineersDirectory),
	}
}

func (r *engineerRepo) ParseEngineersFromCSVByRegion(
	ctx context.Context,
	region string,
) ([]*entities.Engineer, error) {

	filePath := fmt.Sprintf(r.engineersDirectory, region)

	file, err := os.Open(filePath)
	if err != nil {
		return nil, errors.ErrFailedOpenCSV(err.Error())
	}
	defer file.Close()

	return r.ParseEngineersFromCSV(ctx, file)
}

func (r *engineerRepo) ParseEngineersFromCSV(
	ctx context.Context,
	reader io.Reader,
) ([]*entities.Engineer, error) {

	csvReader := csv.NewReader(reader)
	csvReader.Comma = ';'
	csvReader.FieldsPerRecord = -1

	header, err := csvReader.Read()
	if err != nil {
		return nil, errors.ErrInvalidEngineersCSVHeaders(err.Error())
	}

	colIndex := make(map[string]int)
	for i, col := range header {
		colIndex[strings.TrimSpace(col)] = i
	}

	var engineers []*entities.Engineer

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

		shiftStart := parseHMToMinutes(getCol(record, colIndex, "Начало смены"))
		shiftEnd := parseHMToMinutes(getCol(record, colIndex, "Конец смены"))

		depotLat, _ := strconv.ParseFloat(getCol(record, colIndex, "Широта"), 64)
		depotLon, _ := strconv.ParseFloat(getCol(record, colIndex, "Долгота"), 64)

		depotAddress := getCol(record, colIndex, "Адрес")

		skills := splitList[entities.Skill](getCol(record, colIndex, "Навыки"))
		equipment := splitList[entities.Equipment](getCol(record, colIndex, "Оборудование"))

		eng := &entities.Engineer{
			ID:           getCol(record, colIndex, "ID"),
			Name:         getCol(record, colIndex, "ФИО/Бригада"),
			Skills:       skills,
			Equipment:    equipment,
			Transport:    getCol(record, colIndex, "Транспорт"),
			ShiftStart:   shiftStart,
			ShiftEnd:     shiftEnd,
			DepotAddress: depotAddress,
			DepotLat:     depotLat,
			DepotLon:     depotLon,
		}

		engineers = append(engineers, eng)
	}

	return engineers, nil
}

func (r *engineerRepo) GetEngineersMapByIDAndRegion(
	ctx context.Context,
	region string,
) (map[string]*entities.Engineer, error) {
	engineers, err := r.ParseEngineersFromCSVByRegion(
		ctx,
		region,
	)
	if err != nil {
		return nil, err
	}

	resultMap := make(map[string]*entities.Engineer)

	for _, engineer := range engineers {
		resultMap[engineer.ID] = engineer
	}

	return resultMap, nil

}

func (r *engineerRepo) SaveEngineersToCSVByRegion(
	ctx context.Context,
	region string,
	engineers []*entities.Engineer,
) error {
	filePath := fmt.Sprintf(r.engineersDirectory, region)

	file, err := os.Create(filePath)
	if err != nil {
		return errors.ErrFailedOpenCSV(err.Error())
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	writer.Comma = ';'
	defer writer.Flush()

	header := []string{
		"ID", "ФИО/Бригада", "Навыки", "Оборудование",
		"Транспорт", "Начало смены", "Конец смены",
		"Адрес", "Широта", "Долгота",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	for _, eng := range engineers {
		skillsStr := joinData(eng.Skills)
		equipmentStr := joinData(eng.Equipment)
		shiftStartStr := formatMinutesToHM(eng.ShiftStart)
		shiftEndStr := formatMinutesToHM(eng.ShiftEnd)

		record := []string{
			eng.ID,
			eng.Name,
			skillsStr,
			equipmentStr,
			eng.Transport,
			shiftStartStr,
			shiftEndStr,
			eng.DepotAddress,
			fmt.Sprintf("%.6f", eng.DepotLat),
			fmt.Sprintf("%.6f", eng.DepotLon),
		}

		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

func formatMinutesToHM(totalMinutes int) string {
	hours := totalMinutes / 60
	minutes := totalMinutes % 60
	return fmt.Sprintf("%02d:%02d", hours, minutes)
}

func joinData[T entities.Skill | entities.Equipment](data []T) string {
	strData := make([]string, len(data))
	for i, s := range data {
		strData[i] = string(s)
	}
	return strings.Join(strData, ", ")
}

func parseHMToMinutes(timeStr string) int {

	layout := "15:04"
	t, err := time.Parse(layout, strings.TrimSpace(timeStr))
	if err != nil {
		return defaultStartTime
	}

	totalMinutes := t.Hour()*60 + t.Minute()

	return totalMinutes
}

func splitList[T entities.Skill | entities.Equipment](str string) []T {

	if str == "" {
		return []T{}
	}

	items := strings.Split(str, ",")

	var result []T
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, T(trimmed))
		}
	}

	return result
}
