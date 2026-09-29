package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

type CacheRepo struct {
	basePath string
	mu       sync.Mutex
}

func NewCacheRepository(basePath string) *CacheRepo {
	return &CacheRepo{basePath: basePath}
}

func (r *CacheRepo) filePath(kind, region string) string {
	return filepath.Join(r.basePath, region, fmt.Sprintf("%s_%s.json", kind, region))
}

func (r *CacheRepo) SetPlanByRegion(
	ctx context.Context,
	plan *dto.PlanResponse,
	region string,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return writeJSON(r.filePath("plan", region), plan)
}

func (r *CacheRepo) GetPlanByRegion(
	ctx context.Context,
	region string,
) (*dto.PlanResponse, error) {
	var plan dto.PlanResponse
	if err := readJSON(r.filePath("plan", region), &plan); err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *CacheRepo) SetTasksByRegion(
	ctx context.Context,
	tasks []*entities.Task,
	region string,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return writeJSON(r.filePath("tasks", region), tasks)
}

func (r *CacheRepo) AppendTaskByRegion(
	ctx context.Context,
	task *entities.Task,
	region string,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	path := r.filePath("tasks", region)

	var tasks []*entities.Task
	if err := readJSON(path, &tasks); err != nil && !os.IsNotExist(err) {
		return err
	}

	return writeJSON(path, append(tasks, task))
}

func (r *CacheRepo) GetTasksByRegion(
	ctx context.Context,
	region string,
) ([]*entities.Task, error) {
	var tasks []*entities.Task
	if err := readJSON(r.filePath("tasks", region), &tasks); err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *CacheRepo) LoadGeoCache(
	ctx context.Context,
	region string,
) (map[string]entities.GeoData, error) {
	return readGeoMap(r.filePath("geo_data", region))
}

func (r *CacheRepo) SaveGeoCache(
	ctx context.Context,
	region string,
	cache map[string]entities.GeoData,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return writeJSON(r.filePath("geo_data", region), cache)
}

func (r *CacheRepo) LoadDepots(
	ctx context.Context,
	region string,
) (map[string]entities.GeoData, error) {
	return readGeoMap(r.filePath("depot", region))
}

func readGeoMap(path string) (map[string]entities.GeoData, error) {
	result := make(map[string]entities.GeoData)
	if err := readJSON(path, &result); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	return result, nil
}

func readJSON(path string, dst any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, dst)
}

func writeJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, data)
}

func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	if err = os.Chmod(tmp.Name(), 0o644); err != nil {
		return err
	}

	return os.Rename(tmp.Name(), path)
}
