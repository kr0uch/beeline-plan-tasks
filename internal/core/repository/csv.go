package repository

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"time"
)

const csvSeparator = ';'

type csvRows struct {
	reader    *csv.Reader
	colIndex  map[string]int
	lineCount int
}

func newCSVRows(reader io.Reader) (*csvRows, error) {
	csvReader := csv.NewReader(reader)
	csvReader.Comma = csvSeparator
	csvReader.FieldsPerRecord = -1

	header, err := csvReader.Read()
	if err != nil {
		return nil, err
	}

	colIndex := make(map[string]int, len(header))
	for i, col := range header {
		colIndex[strings.TrimPrefix(strings.TrimSpace(col), "\ufeff")] = i
	}

	return &csvRows{reader: csvReader, colIndex: colIndex, lineCount: 1}, nil
}

func (r *csvRows) missingColumns(required []string) []string {
	var missing []string
	for _, col := range required {
		if _, ok := r.colIndex[col]; !ok {
			missing = append(missing, col)
		}
	}
	return missing
}

func (r *csvRows) next() (csvRow, error) {
	for {
		record, err := r.reader.Read()
		if err != nil {
			return csvRow{}, err
		}
		r.lineCount++

		if !isBlankRecord(record) {
			return csvRow{record: record, colIndex: r.colIndex, line: r.lineCount}, nil
		}
	}
}

type csvRow struct {
	record   []string
	colIndex map[string]int
	line     int
}

func (r csvRow) get(colName string) string {
	idx, ok := r.colIndex[colName]
	if !ok || idx >= len(r.record) {
		return ""
	}
	return strings.TrimSpace(r.record[idx])
}

func (r csvRow) errorf(format string, args ...any) string {
	return fmt.Sprintf("line %d: %s", r.line, fmt.Sprintf(format, args...))
}

func isBlankRecord(record []string) bool {
	for _, field := range record {
		if strings.TrimSpace(field) != "" {
			return false
		}
	}
	return true
}

func parseClockToMinutes(value, layout string) (int, error) {
	t, err := time.Parse(layout, strings.TrimSpace(value))
	if err != nil {
		return 0, err
	}
	return t.Hour()*60 + t.Minute(), nil
}

func formatMinutesToHM(totalMinutes int) string {
	return fmt.Sprintf("%02d:%02d", totalMinutes/60, totalMinutes%60)
}
