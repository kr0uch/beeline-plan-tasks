package service

import (
	"context"
	"io"
	"os"
	"slices"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const mlPingTimeout = 2 * time.Second

type EngineerRepository interface {
	ParseEngineersFromCSVByRegion(
		ctx context.Context,
		region string,
	) ([]*entities.Engineer, error)
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
	Ping(ctx context.Context) error
}

type GeoRepository interface {
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
	SetPlanByRegion(
		ctx context.Context,
		plan *dto.PlanResponse,
		region string,
	) error
	GetPlanByRegion(
		ctx context.Context,
		region string,
	) (*dto.PlanResponse, error)
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
		ctx context.Context,
		region string,
	) (map[string]entities.GeoData, error)
	SaveGeoCache(
		ctx context.Context,
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

	tasks, err := s.taskRepository.ParseTasksFromCSV(ctx, request.TasksReader)
	if err != nil {
		return nil, err
	}

	engineers, err := s.loadEngineers(ctx, request.Region)
	if err != nil {
		return nil, err
	}

	if err = s.fillTasksGeoData(ctx, request.Region, tasks); err != nil {
		return nil, err
	}

	located, notLocated := splitByGeoData(tasks)

	plan, err := s.mlRepository.FetchOptimalPlan(ctx, &dto.MLPlanRequest{
		Region:    request.Region,
		Tasks:     located,
		Engineers: engineers,
	})
	if err != nil {
		return nil, err
	}

	fillRouteTaskIDs(plan)
	plan.Unassigned = append(plan.Unassigned, unassignedAddressNotFound(notLocated)...)
	attachTasks(plan, tasks)

	plan.BaselineMetrics, err = s.calculateBaselineMetrics(ctx, located, engineers, nil)
	if err != nil {
		return nil, err
	}

	s.explain(ctx, plan, request.ExplainWithLLM)

	if err = s.cacheRepository.SetTasksByRegion(ctx, tasks, request.Region); err != nil {
		return nil, err
	}
	if err = s.cacheRepository.SetPlanByRegion(ctx, plan, request.Region); err != nil {
		return nil, err
	}

	return plan, nil
}

func (s *PlanService) Replan(
	ctx context.Context,
	request *dto.ReplanRequest,
) (*dto.PlanResponse, error) {

	prevPlan, err := s.GetCurrentPlan(ctx, request.Region)
	if err != nil {
		return nil, err
	}

	engineers, err := s.loadEngineers(ctx, request.Region)
	if err != nil {
		return nil, err
	}

	allTasks, err := s.cacheRepository.GetTasksByRegion(ctx, request.Region)
	if os.IsNotExist(err) {
		return nil, errors.ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}

	tasksToLocate := allTasks
	if request.NewTask != nil {
		tasksToLocate = append(slices.Clone(allTasks), request.NewTask)
	}
	if err = s.fillTasksGeoData(ctx, request.Region, tasksToLocate); err != nil {
		return nil, err
	}

	state, err := buildDayState(
		request.CurrentTimeMin,
		prevPlan,
		engineers,
		allTasks,
		request.NewTask,
	)
	if err != nil {
		return nil, err
	}

	pendingTasks, notLocated := splitByGeoData(state.pendingTasks)

	fresh, err := s.mlRepository.FetchOptimalReplan(ctx, &dto.MLReplanRequest{
		Region:        request.Region,
		NewTask:       request.NewTask,
		CurrentState:  state.engineers,
		PendingTasks:  pendingTasks,
		LockedTaskIds: state.lockedTaskIDs,
		Engineers:     engineers,
	})
	if err != nil {
		return nil, err
	}

	fillRouteTaskIDs(fresh)
	plan := mergeReplan(fresh, state, engineers)
	plan.Unassigned = append(plan.Unassigned, unassignedAddressNotFound(notLocated)...)
	attachTasks(plan, tasksToLocate)

	baselineTasks := slices.Clone(pendingTasks)
	if request.NewTask != nil && hasTaskCoords(request.NewTask) {
		baselineTasks = append(baselineTasks, request.NewTask)
	}

	plan.BaselineMetrics, err = s.calculateBaselineMetrics(ctx, baselineTasks, engineers, state.engineers)
	if err != nil {
		return nil, err
	}

	s.explain(ctx, plan, request.ExplainWithLLM)

	newTaskID := 0
	if request.NewTask != nil {
		newTaskID = request.NewTask.ID
	}
	plan.Changes = diffPlans(prevPlan, plan, newTaskID)

	if err = s.cacheRepository.SetPlanByRegion(ctx, plan, request.Region); err != nil {
		return nil, err
	}

	if request.NewTask != nil && !containsTaskID(allTasks, request.NewTask.ID) {
		if err = s.cacheRepository.AppendTaskByRegion(ctx, request.NewTask, request.Region); err != nil {
			return nil, err
		}
	}

	return plan, nil
}

func (s *PlanService) GetCurrentPlan(
	ctx context.Context,
	region string,
) (*dto.PlanResponse, error) {

	plan, err := s.cacheRepository.GetPlanByRegion(ctx, region)
	if os.IsNotExist(err) {
		return nil, errors.ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}

	return plan, nil
}

func (s *PlanService) Health(ctx context.Context) *dto.HealthResponse {
	ctx, cancel := context.WithTimeout(ctx, mlPingTimeout)
	defer cancel()

	health := &dto.HealthResponse{Status: "ok", ML: "ok"}
	if err := s.mlRepository.Ping(ctx); err != nil {
		health.ML = "unavailable"
	}

	return health
}

func (s *PlanService) explain(
	ctx context.Context, 
	plan *dto.PlanResponse, 
	withLLM bool,
) {
	
	fillRuleExplanations(plan)
	if withLLM {
		s.groqClient.EnrichPlan(ctx, plan)
	}
}

func (s *PlanService) loadEngineers(
	ctx context.Context,
	region string,
) ([]*entities.Engineer, error) {

	engineers, err := s.engineerRepository.ParseEngineersFromCSVByRegion(ctx, region)
	if err != nil {
		return nil, err
	}

	if err = s.fillEngineersGeoData(ctx, region, engineers); err != nil {
		return nil, err
	}

	return engineers, nil
}

func containsTaskID(
	tasks []*entities.Task, 
	id int,
) bool {

	return slices.ContainsFunc(tasks, func(t *entities.Task) bool {
		return t.ID == id
	})
}
