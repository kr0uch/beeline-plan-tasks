package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

type CacheRepository interface {
	SetRoutesByRegion(
		ctx context.Context,
		routes []dto.Route,
		region string,
	) error
	GetRoutesByRegion(
		ctx context.Context,
		region string,
	) ([]dto.Route, error)
	SetTasksByRegion(
		ctx context.Context,
		tasks []*entities.Task,
		region string,
	) error
	AppendTaskByRegion(
		ctx context.Context,
		task *entities.Task,
		region string,
	) error
	GetTasksByRegion(
		ctx context.Context,
		region string,
	) ([]*entities.Task, error)
	LoadGeoCache(
		region string,
	) (map[string]entities.GeoData, error)
	SaveGeoCache(
		region string,
		cache map[string]entities.GeoData,
	) error
	LoadDepots(
		ctx context.Context,
		region string,
	) (map[string]entities.GeoData, error)
}

type cacheRepo struct {
	basePath string
}

func NewCacheRepository(basePath string) CacheRepository {
	return &cacheRepo{
		basePath: basePath,
	}
}

const routesTemplate = "%s/routes_%s.json"

func (r *cacheRepo) SetRoutesByRegion(
	ctx context.Context,
	routes []dto.Route,
	region string,
) error {
	filePath := path.Join(r.basePath, fmt.Sprintf(routesTemplate, region, region))

	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	bytes, err := json.Marshal(routes)
	if err != nil {
		return err
	}

	if _, err := file.Write(bytes); err != nil {
		return err
	}

	return nil
}

func (r *cacheRepo) GetRoutesByRegion(
	ctx context.Context,
	region string,
) ([]dto.Route, error) {
	filePath := path.Join(r.basePath, fmt.Sprintf(routesTemplate, region, region))

	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var routes []dto.Route
	if err := json.NewDecoder(file).Decode(&routes); err != nil {
		return nil, err
	}

	return routes, nil
}

const tasksTemplate = "%s/tasks_%s.json"

func (r *cacheRepo) SetTasksByRegion(
	ctx context.Context,
	tasks []*entities.Task,
	region string,
) error {
	filePath := path.Join(r.basePath, fmt.Sprintf(tasksTemplate, region, region))

	dir := path.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	bytes, err := json.Marshal(tasks)
	if err != nil {
		return err
	}

	if _, err := file.Write(bytes); err != nil {
		return err
	}

	return nil
}

func (r *cacheRepo) AppendTaskByRegion(
	ctx context.Context,
	task *entities.Task,
	region string,
) error {
	tasks, err := r.GetTasksByRegion(ctx, region)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	tasks = append(tasks, task)

	return r.SetTasksByRegion(ctx, tasks, region)
}

func (r *cacheRepo) GetTasksByRegion(
	ctx context.Context,
	region string,
) ([]*entities.Task, error) {

	filePath := path.Join(r.basePath, fmt.Sprintf(tasksTemplate, region, region))
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var tasks []*entities.Task
	if err := json.NewDecoder(file).Decode(&tasks); err != nil {
		return nil, err
	}

	return tasks, nil
}

const geoDataTemplate = "%s/geo_data_%s.json"

func (r *cacheRepo) LoadGeoCache(
	region string,
) (map[string]entities.GeoData, error) {

	filePath := path.Join(r.basePath, fmt.Sprintf(geoDataTemplate, region, region))

	file, err := os.Open(filePath)
	if os.IsNotExist(err) {
		return make(map[string]entities.GeoData), nil
	} else if err != nil {
		return nil, err
	}
	defer file.Close()

	cache := make(map[string]entities.GeoData)
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&cache); err != nil && err != io.EOF {
		return nil, err
	}
	return cache, nil
}

func (r *cacheRepo) SaveGeoCache(
	region string,
	cache map[string]entities.GeoData,
) error {

	filePath := path.Join(r.basePath, fmt.Sprintf(geoDataTemplate, region, region))

	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	bytes, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}

	if _, err := file.Write(bytes); err != nil {
		return err
	}

	return nil
}

const depotTemplate = "%s/depot_%s.json"

func (r *cacheRepo) LoadDepots(
	ctx context.Context,
	region string,
) (map[string]entities.GeoData, error) {

	filePath := path.Join(r.basePath, fmt.Sprintf(depotTemplate, region, region))

	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[string]entities.GeoData), nil
		}
		return nil, err
	}
	defer file.Close()

	var depots map[string]entities.GeoData
	if err := json.NewDecoder(file).Decode(&depots); err != nil {
		return nil, err
	}

	return depots, nil
}
