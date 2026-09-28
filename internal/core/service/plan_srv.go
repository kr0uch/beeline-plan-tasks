package service

import (
	"context"
	"fmt"
	"io"
	"math"
	"sort"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type EngineerRepository interface {
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

type TaskRepository interface {
	ParseTasksFromCSV(
		ctx context.Context,
		reader io.Reader,
	) ([]*entities.Task, error)
}

type MLRepository interface {
	FetchOptimalPlan(
		ctx context.Context,
		request *dto.MLPlanRequest,
	) (*dto.PlanResponse, error)
	FetchOptimalReplan(
		ctx context.Context,
		request *dto.MLReplanRequest,
	) (*dto.PlanResponse, error)
}

type GeoRepository interface {
	GetDistanceAndTravelTime(
		ctx context.Context,
		request *dto.GetDistanceAndTravelTimeRequest,
	) (*dto.GetDistanceAndTravelTimeResponse, error)
	BatchGetGeoDataByAddresses(
		ctx context.Context,
		addresses []string,
	) (dto.BatchGeoDataByAddressResponse, error)
	GetDistanceAndTravelTimeHaversine(
		ctx context.Context,
		request *dto.GetDistanceAndTravelTimeRequest,
	) (*dto.GetDistanceAndTravelTimeResponse, error)
}

type GroqClient interface {
	EnrichPlan(ctx context.Context, resp *dto.PlanResponse)
}

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

type PlanService struct {
	engineerRepository EngineerRepository
	taskRepository     TaskRepository
	mlRepository       MLRepository
	geoRepository      GeoRepository
	groqClient         GroqClient
	cacheRepository    CacheRepository
}

func NewPlanService(
	engineerRepository EngineerRepository,
	taskRepository TaskRepository,
	mlRepository MLRepository,
	geoRepository GeoRepository,
	groqClient GroqClient,
	cacheRepository CacheRepository,
) *PlanService {

	return &PlanService{
		engineerRepository: engineerRepository,
		taskRepository:     taskRepository,
		mlRepository:       mlRepository,
		geoRepository:      geoRepository,
		groqClient:         groqClient,
		cacheRepository:    cacheRepository,
	}
}

func (s *PlanService) Plan(
	ctx context.Context,
	request *dto.PlanRequest,
) (*dto.PlanResponse, error) {

	tasks, err := s.taskRepository.ParseTasksFromCSV(
		ctx,
		request.TasksReader,
	)
	if err != nil {
		return nil, err
	}

	err = s.cacheRepository.SetTasksByRegion(ctx, tasks, request.Region)
	if err != nil {
		return nil, err
	}

	if err = s.fillTasksGeoData(ctx, request.Region, tasks); err != nil {
		return nil, err
	}

	var engineers []*entities.Engineer

	engineers, err = s.engineerRepository.ParseEngineersFromCSVByRegion(
		ctx,
		request.Region,
	)
	if err != nil {
		return nil, err
	}

	if err = s.fillEngineersGeoData(ctx, request.Region, engineers); err != nil {
		return nil, err
	}

	mlRequest := &dto.MLPlanRequest{
		Region:    request.Region,
		Tasks:     tasks,
		Engineers: engineers,
	}

	plan, err := s.mlRepository.FetchOptimalPlan(ctx, mlRequest)
	if err != nil {
		return nil, err
	}

	if err = s.cacheRepository.SetRoutesByRegion(ctx, plan.Routes, request.Region); err != nil {
		return nil, err
	}

	baselineMetrics, err := s.calculateBaselineMetrics(
		ctx,
		mlRequest.Tasks,
		mlRequest.Engineers,
		nil,
	)
	if err != nil {
		return nil, err
	}

	plan.BaselineMetrics = baselineMetrics

	s.groqClient.EnrichPlan(ctx, plan)

	return plan, nil
}

func (s *PlanService) Replan(
	ctx context.Context,
	request *dto.ReplanRequest,
) (*dto.PlanResponse, error) {

	routes, err := s.cacheRepository.GetRoutesByRegion(
		ctx,
		request.Region,
	)
	if err != nil {
		return nil, err
	}
	engMap, err := s.engineerRepository.GetEngineersMapByIDAndRegion(ctx, request.Region)
	if err != nil {
		return nil, err
	}

	allTasks, err := s.cacheRepository.GetTasksByRegion(ctx, request.Region)
	if err != nil {
		return nil, err
	}

	if err = s.fillTasksGeoData(ctx, request.Region, allTasks); err != nil {
		return nil, err
	}

	taskMapByDetails := make(map[string]*entities.Task)
	for _, t := range allTasks {
		key := fmt.Sprintf("%s_%d_%d", t.Address, t.TWStart, t.TWEnd)
		taskMapByDetails[key] = t
	}

	pendingTasks := make([]*entities.Task, 0)
	currentState := make(map[string]dto.EngineerState)
	lockedTaskIds := make([]int, 0)
	lockedMap := make(map[int]bool)

	for _, route := range routes {
		if len(route.Tasks) == 0 {
			continue
		}

		eng, ok := engMap[route.EngineerId]
		if !ok {
			return nil, errors.ErrEngineerIdNotFound
		}

		currentLat := eng.DepotLat
		currentLon := eng.DepotLon
		currentVirtualTime := eng.ShiftStart
		isEngineerBusy := false

		for _, routeTask := range route.Tasks {
			key := fmt.Sprintf("%s_%d_%d", routeTask.Address, routeTask.TWStart, routeTask.TWEnd)
			task, found := taskMapByDetails[key]
			if !found {
				task = routeTask
			}

			geoReq := &dto.GetDistanceAndTravelTimeRequest{
				CurrentLat: currentLat,
				CurrentLon: currentLon,
				TargetLat:  task.Lat,
				TargetLon:  task.Lon,
			}
			geoResp, err := s.geoRepository.GetDistanceAndTravelTime(ctx, geoReq)
			if err != nil {
				return nil, err
			}

			arrivalTime := currentVirtualTime + geoResp.Time
			startServiceTime := arrivalTime
			if startServiceTime < task.TWStart {
				startServiceTime = task.TWStart
			}
			endServiceTime := startServiceTime + task.ServiceTime

			if request.CurrentTimeMin >= endServiceTime {
				currentVirtualTime = endServiceTime
				currentLat = task.Lat
				currentLon = task.Lon
				continue
			}

			if !isEngineerBusy {
				lockedTaskIds = append(lockedTaskIds, task.ID)
				lockedMap[task.ID] = true
				isEngineerBusy = true

				currentState[route.EngineerId] = dto.EngineerState{
					GeoData: entities.GeoData{
						Lat: currentLat,
						Lon: currentLon,
					},
					TimeMin: endServiceTime,
				}
			} else {
				pendingTasks = append(pendingTasks, task)
			}
		}

		if !isEngineerBusy {
			currentState[route.EngineerId] = dto.EngineerState{
				GeoData: entities.GeoData{
					Lat: currentLat,
					Lon: currentLon,
				},
				TimeMin: request.CurrentTimeMin,
			}
		}
	}

	for _, task := range allTasks {
		isPendingAlready := false
		for _, pt := range pendingTasks {
			if pt.ID == task.ID {
				isPendingAlready = true
				break
			}
		}

		if !lockedMap[task.ID] && !isPendingAlready {
			if task.TWEnd >= request.CurrentTimeMin {
				pendingTasks = append(pendingTasks, task)
			}
		}
	}

	engineersSlice := make([]*entities.Engineer, 0, len(engMap))
	for _, eng := range engMap {
		engineersSlice = append(engineersSlice, eng)
	}
	sort.Slice(engineersSlice, func(i, j int) bool {
		return engineersSlice[i].ID < engineersSlice[j].ID
	})

	if err = s.fillEngineersGeoData(ctx, request.Region, engineersSlice); err != nil {
		return nil, err
	}

	mlRequest := &dto.MLReplanRequest{
		Region:        request.Region,
		NewTask:       request.NewTask,
		CurrentState:  currentState,
		PendingTasks:  pendingTasks,
		LockedTaskIds: lockedTaskIds,
		Engineers:     engineersSlice,
	}

	plan, err := s.mlRepository.FetchOptimalReplan(ctx, mlRequest)
	if err != nil {
		return nil, err
	}

	tasksForBaseline := make([]*entities.Task, 0, len(mlRequest.PendingTasks)+1)
	tasksForBaseline = append(tasksForBaseline, mlRequest.PendingTasks...)

	if request.NewTask != nil {
		isNewTaskInPending := false
		for _, pt := range mlRequest.PendingTasks {
			if pt.ID == request.NewTask.ID {
				isNewTaskInPending = true
				break
			}
		}
		if !isNewTaskInPending {
			tasksForBaseline = append(tasksForBaseline, request.NewTask)
		}
	}

	baselineMetrics, err := s.calculateBaselineMetrics(
		ctx,
		tasksForBaseline,
		mlRequest.Engineers,
		currentState,
	)
	if err != nil {
		return nil, err
	}
	plan.BaselineMetrics = baselineMetrics

	s.groqClient.EnrichPlan(ctx, plan)

	err = s.cacheRepository.AppendTaskByRegion(
		ctx,
		request.NewTask,
		request.Region,
	)
	if err != nil {
		return nil, err
	}

	return plan, nil
}

func (s *PlanService) fillEngineersGeoData(
	ctx context.Context,
	region string,
	engineers []*entities.Engineer,
) error {
	needsGeocoding := false
	for _, eng := range engineers {
		if eng.DepotLat == 0 && eng.DepotLon == 0 && eng.DepotAddress != "" {
			needsGeocoding = true
			break
		}
	}
	if !needsGeocoding {
		return nil
	}

	staticDepots, _ := s.cacheRepository.LoadDepots(ctx, region)
	geoCache, err := s.cacheRepository.LoadGeoCache(region)
	if err != nil {
		return err
	}

	missingAddressesMap := make(map[string]bool)
	coordinatesUpdated := false

	for _, eng := range engineers {
		if eng.DepotLat != 0 || eng.DepotLon != 0 || eng.DepotAddress == "" {
			continue
		}

		if depot, ok := staticDepots[eng.DepotAddress]; ok && (depot.Lat != 0 || depot.Lon != 0) {
			eng.DepotLat = depot.Lat
			eng.DepotLon = depot.Lon
			coordinatesUpdated = true
			continue
		}

		if cached, ok := geoCache[eng.DepotAddress]; ok && (cached.Lat != 0 || cached.Lon != 0) {
			eng.DepotLat = cached.Lat
			eng.DepotLon = cached.Lon
			coordinatesUpdated = true
			continue
		}

		missingAddressesMap[eng.DepotAddress] = true
	}

	if len(missingAddressesMap) > 0 {
		missingAddresses := make([]string, 0, len(missingAddressesMap))
		for addr := range missingAddressesMap {
			missingAddresses = append(missingAddresses, addr)
		}

		batchResults, err := s.geoRepository.BatchGetGeoDataByAddresses(ctx, missingAddresses)
		if err != nil {
			return err
		}

		for addr, geoResp := range batchResults {
			if geoResp.Lat != 0 || geoResp.Lon != 0 {
				geoCache[addr] = entities.GeoData{
					Lat: geoResp.Lat,
					Lon: geoResp.Lon,
				}
			}
		}

		for _, eng := range engineers {
			if eng.DepotLat == 0 && eng.DepotLon == 0 {
				if cached, ok := geoCache[eng.DepotAddress]; ok {
					eng.DepotLat = cached.Lat
					eng.DepotLon = cached.Lon
					coordinatesUpdated = true
				}
			}
		}

		if err = s.cacheRepository.SaveGeoCache(region, geoCache); err != nil {
			return err
		}
	}

	if coordinatesUpdated {
		if err = s.engineerRepository.SaveEngineersToCSVByRegion(ctx, region, engineers); err != nil {
			return err
		}
	}

	return nil
}

func (s *PlanService) fillTasksGeoData(
	ctx context.Context,
	region string,
	tasks []*entities.Task,
) error {
	geoCache, err := s.cacheRepository.LoadGeoCache(region)
	if err != nil {
		return err
	}

	missingAddressesMap := make(map[string]bool)
	for _, task := range tasks {
		if cached, ok := geoCache[task.Address]; ok {
			task.Lat = cached.Lat
			task.Lon = cached.Lon
		} else if task.Address != "" {
			missingAddressesMap[task.Address] = true
		}
	}

	if len(missingAddressesMap) == 0 {
		return nil
	}

	missingAddresses := make([]string, 0, len(missingAddressesMap))
	for addr := range missingAddressesMap {
		missingAddresses = append(missingAddresses, addr)
	}

	batchResults, err := s.geoRepository.BatchGetGeoDataByAddresses(ctx, missingAddresses)
	if err != nil {
		return err
	}

	cacheUpdated := false

	for addr, geoResp := range batchResults {
		geoCache[addr] = entities.GeoData{
			Lat: geoResp.Lat,
			Lon: geoResp.Lon,
		}
		cacheUpdated = true
	}

	for _, task := range tasks {
		if cached, ok := geoCache[task.Address]; ok {
			task.Lat = cached.Lat
			task.Lon = cached.Lon
		}
	}

	if cacheUpdated {
		if err := s.cacheRepository.SaveGeoCache(region, geoCache); err != nil {
			return err
		}
	}

	return nil
}

func (s *PlanService) calculateBaselineMetrics(
	ctx context.Context,
	tasks []*entities.Task,
	engineers []*entities.Engineer,
	currentState map[string]dto.EngineerState,
) (*dto.Metrics, error) {
	totalTasks := len(tasks)
	if totalTasks == 0 {
		return &dto.Metrics{Status: "OK"}, nil
	}

	engineerTime := make(map[string]int)
	engineerLastLoc := make(map[string]entities.GeoData)
	engineerTaskCount := make(map[string]int)
	usedEngineers := make(map[string]bool)

	for _, eng := range engineers {
		if state, ok := currentState[eng.ID]; ok {
			engineerTime[eng.ID] = state.TimeMin
			engineerLastLoc[eng.ID] = entities.GeoData{Lat: state.Lat, Lon: state.Lon}
		} else {
			engineerTime[eng.ID] = eng.ShiftStart
			engineerLastLoc[eng.ID] = entities.GeoData{Lat: eng.DepotLat, Lon: eng.DepotLon}
		}
		engineerTaskCount[eng.ID] = 0
	}

	assignedCount := 0
	lateCount := 0
	totalLateMin := 0
	totalDistanceKm := 0.0

	for _, t := range tasks {
		taskLoc := entities.GeoData{Lat: t.Lat, Lon: t.Lon}

		for _, eng := range engineers {
			if !hasSkills(eng.Skills, t.RequiredSkills) {
				continue
			}

			currLoc := engineerLastLoc[eng.ID]

			var travelTime int
			var dist float64

			if currLoc.Lat == t.Lat && currLoc.Lon == t.Lon {
				travelTime = 0
				dist = 0
			} else {
				distanceAndTravelTimeResponse, err := s.geoRepository.GetDistanceAndTravelTimeHaversine(
					ctx,
					&dto.GetDistanceAndTravelTimeRequest{
						CurrentLat: currLoc.Lat,
						CurrentLon: currLoc.Lon,
						TargetLat:  t.Lat,
						TargetLon:  t.Lon,
					})
				if err != nil {
					return nil, err
				}
				travelTime = distanceAndTravelTimeResponse.Time
				dist = distanceAndTravelTimeResponse.Distance
			}

			arrivalTime := engineerTime[eng.ID] + travelTime
			startTime := arrivalTime
			if startTime < t.TWStart {
				startTime = t.TWStart
			}

			if startTime+t.ServiceTime <= eng.ShiftEnd {
				if arrivalTime > t.TWEnd {
					lateCount++
					totalLateMin += (arrivalTime - t.TWEnd)
				}

				assignedCount++
				usedEngineers[eng.ID] = true
				totalDistanceKm += dist

				engineerTime[eng.ID] = startTime + t.ServiceTime
				engineerLastLoc[eng.ID] = taskLoc
				engineerTaskCount[eng.ID]++
				break
			}
		}
	}

	overtimeMin := 0
	for _, eng := range engineers {
		if engineerTime[eng.ID] > eng.ShiftEnd {
			overtimeMin += (engineerTime[eng.ID] - eng.ShiftEnd)
		}
	}

	var loadMean, loadStd float64
	loadMin := math.MaxInt32
	loadMax := 0

	if len(engineers) > 0 {
		for _, eng := range engineers {
			count := engineerTaskCount[eng.ID]

			if count < loadMin {
				loadMin = count
			}
			if count > loadMax {
				loadMax = count
			}
		}

		loadMean = float64(assignedCount) / float64(len(engineers))

		var varianceSum float64
		for _, eng := range engineers {
			diff := float64(engineerTaskCount[eng.ID]) - loadMean
			varianceSum += diff * diff
		}
		loadStd = math.Sqrt(varianceSum / float64(len(engineers)))
	} else {
		loadMin = 0
	}

	unassigned := totalTasks - assignedCount
	assignedRate := 0.0
	if totalTasks > 0 {
		assignedRate = float64(assignedCount) / float64(totalTasks)
	}

	return &dto.Metrics{
		Status:          "OK",
		TotalTasks:      totalTasks,
		Assigned:        assignedCount,
		Unassigned:      unassigned,
		AssignedRate:    math.Round(assignedRate*10000) / 10000,
		LateCount:       lateCount,
		TotalLateMin:    totalLateMin,
		OvertimeMin:     overtimeMin,
		LoadMean:        math.Round(loadMean*100) / 100,
		LoadStd:         math.Round(loadStd*100) / 100,
		LoadMax:         loadMax,
		LoadMin:         loadMin,
		EngineersUsed:   len(usedEngineers),
		TotalDistanceKm: math.Round(totalDistanceKm*100) / 100,
	}, nil
}

func hasSkills(engSkills, reqSkills []entities.Skill) bool {
	m := make(map[entities.Skill]bool, len(engSkills))
	for _, s := range engSkills {
		m[s] = true
	}

	for _, r := range reqSkills {
		if !m[r] {
			return false
		}
	}

	return true
}
