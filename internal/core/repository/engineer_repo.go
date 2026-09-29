package repository

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const shiftTimeLayout = "15:04"

var engineersCSVHeader = []string{
	"ID", "ФИО/Бригада", "Навыки", "Оборудование",
	"Транспорт", "Начало смены", "Конец смены",
	"Адрес", "Широта", "Долгота",
}

var requiredEngineerColumns = []string{
	"ID", "ФИО/Бригада", "Навыки", "Оборудование",
	"Начало смены", "Конец смены", "Адрес",
}

type EngineerRepo struct {
	engineersDir string
}

func NewEngineerRepository(engineersDir string) *EngineerRepo {
	return &EngineerRepo{engineersDir: engineersDir}
}

func (r *EngineerRepo) filePath(region string) string {
	return filepath.Join(r.engineersDir, fmt.Sprintf("engineers_%s.csv", region))
}

func (r *EngineerRepo) ParseEngineersFromCSVByRegion(
	ctx context.Context,
	region string,
) ([]*entities.Engineer, error) {

	file, err := os.Open(r.filePath(region))
	if os.IsNotExist(err) {
		return nil, errors.ErrRegionNotFound
	}
	if err != nil {
		return nil, errors.ErrOpenEngineersCSV(err.Error())
	}
	defer file.Close()

	return r.ParseEngineersFromCSV(ctx, file)
}

func (r *EngineerRepo) ParseEngineersFromCSV(
	ctx context.Context,
	reader io.Reader,
) ([]*entities.Engineer, error) {

	rows, err := newCSVRows(reader)
	if err != nil {
		return nil, errors.ErrInvalidEngineersCSVHeaders(err.Error())
	}
	if missing := rows.missingColumns(requiredEngineerColumns); len(missing) > 0 {
		return nil, errors.ErrInvalidEngineersCSVHeaders("missing: " + strings.Join(missing, ", "))
	}

	var engineers []*entities.Engineer
	for {
		row, err := rows.next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.ErrInvalidEngineerRow(err.Error())
		}
		if row.get("ID") == "" {
			continue
		}

		eng, err := parseEngineerRow(row)
		if err != nil {
			return nil, err
		}
		engineers = append(engineers, eng)
	}

	return engineers, nil
}

func parseEngineerRow(row csvRow) (*entities.Engineer, error) {
	shiftStart, err := parseClockToMinutes(row.get("Начало смены"), shiftTimeLayout)
	if err != nil {
		return nil, errors.ErrInvalidEngineerRow(row.errorf("invalid shift start %q", row.get("Начало смены")))
	}

	shiftEnd, err := parseClockToMinutes(row.get("Конец смены"), shiftTimeLayout)
	if err != nil {
		return nil, errors.ErrInvalidEngineerRow(row.errorf("invalid shift end %q", row.get("Конец смены")))
	}

	depotLat, _ := strconv.ParseFloat(row.get("Широта"), 64)
	depotLon, _ := strconv.ParseFloat(row.get("Долгота"), 64)

	return &entities.Engineer{
		ID:           row.get("ID"),
		Name:         row.get("ФИО/Бригада"),
		Skills:       splitList[entities.Skill](row.get("Навыки")),
		Equipment:    splitList[entities.Equipment](row.get("Оборудование")),
		Transport:    row.get("Транспорт"),
		ShiftStart:   shiftStart,
		ShiftEnd:     shiftEnd,
		DepotAddress: row.get("Адрес"),
		DepotLat:     depotLat,
		DepotLon:     depotLon,
	}, nil
}

func (r *EngineerRepo) SaveEngineersToCSVByRegion(
	ctx context.Context,
	region string,
	engineers []*entities.Engineer,
) error {

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = csvSeparator

	if err := writer.Write(engineersCSVHeader); err != nil {
		return err
	}

	for _, eng := range engineers {
		record := []string{
			eng.ID,
			eng.Name,
			joinList(eng.Skills),
			joinList(eng.Equipment),
			eng.Transport,
			formatMinutesToHM(eng.ShiftStart),
			formatMinutesToHM(eng.ShiftEnd),
			eng.DepotAddress,
			strconv.FormatFloat(eng.DepotLat, 'f', 6, 64),
			strconv.FormatFloat(eng.DepotLon, 'f', 6, 64),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return err
	}

	return writeFileAtomic(r.filePath(region), buf.Bytes())
}

func joinList[T ~string](items []T) string {
	parts := make([]string, len(items))
	for i, item := range items {
		parts[i] = string(item)
	}
	return strings.Join(parts, ", ")
}

func splitList[T ~string](value string) []T {
	result := make([]T, 0)
	for _, item := range strings.Split(value, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			result = append(result, T(trimmed))
		}
	}
	return result
}
